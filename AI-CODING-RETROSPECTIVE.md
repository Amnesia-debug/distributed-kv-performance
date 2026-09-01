# AI Coding 复盘：局部正确掩盖了重复工作

## 背景

为了让 Compaction 与普通 Put/Range 分开提交，我接受了一个改动范围很小、功能上也正确的实现：先解码 Raft command 判断它是否为 Compaction，普通请求进入 Apply batch 后再解码一次。

问题不在某一行代码是否正确，而在于我没有沿着请求的完整生命周期检查数据已经在哪个阶段被解析过，结果让同一条普通 Raft 日志走了两次反序列化。

```text
Raft command
  -> 解码并判断是否为 Compaction
  -> 普通请求进入 Apply batch
  -> 再次解码并执行 Apply
```

修复前的代码路径如下。行号对应当时版本，当前源码已经发生变化：

- `kvserver/server.go:659`：为 Compaction 分类而第一次解码。
- `kvserver/server.go:725`：普通请求进入 Apply batch。
- `kvserver/server.go:757`：Apply 时再次解码。
- `kvserver/server.go:422`：每次解码都创建新的 `gob.Decoder`。
- `kvserver/server.go:579`：Apply 由单个 applier goroutine 串行执行。

## pprof 给出的证据

Cold Put、并发 64 的 Leader CPU profile 中：

| 调用路径 | 累计 CPU 占比 |
| --- | ---: |
| `KVServer.applier` | 43.08% |
| `applyCommandBatch` | 42.70% |
| `decodeInternalRequest` | 40.03% |
| `gob.Decoder.Decode` | 39.39% |
| `gob.Decoder.compileDec` | 27.42% |
| `runtime.mallocgc` | 20.58% |

Profile 文件：

```text
results/myetcd-coalesced-final-matrix-profile-20260901/profiles/cold-put-c64/node0/cpu.pb.gz
```

这些数据能够支持以下判断：

1. 解码位于 Put 的主要 CPU 热路径上。
2. 重复解码发生在单线程 Apply 路径中，因此会直接消耗该串行阶段的处理预算。
3. 每次创建新的 `gob.Decoder` 还带来了 schema 编译和内存分配成本。

但 pprof 的占比不能单独证明“重复解码解释了全部 QPS 差距”，也不能直接等价为优化后的吞吐量增幅。因此后续使用相同机器和测试契约执行了移除重复解码前后的矩阵 A/B。

## 修复与验证结果

修复后的 `decodeApplyBatch` 先把每条 Raft Apply 消息解码为 `decodedApplyMessage`。Compaction 分类与普通 Apply 共享其中的结构化请求和解码错误，不再从原始 command 字节重复恢复对象：

- `kvserver/server.go:637`：保存原始 ApplyMsg、解码请求和错误。
- `kvserver/server.go:643`：整个 batch 统一解码一次。
- `kvserver/server.go:665`：基于同一批解码结果分隔 Compaction。
- `kvserver/server.go:745`：普通 Apply 直接使用已解码请求。
- `kvserver/server_test.go:264`：破坏原始 command 字节后 Apply 仍成功，防止重新引入二次解码。

使用相同四台机器、kvbench、100,000 请求/case、相同并发度和存储参数重跑 20-case 矩阵。结果为 2,000,000 次请求全部成功，0 最终失败。代表性 A/B 如下：

| Case | 修复前 QPS | 修复后 QPS | 变化 | P99 变化 |
| --- | ---: | ---: | ---: | ---: |
| Cold Put c32 | 3,527 | 5,527 | +56.7% | 17.86 ms -> 12.42 ms |
| Cold Put c64 | 6,283 | 7,818 | +24.4% | 22.98 ms -> 18.76 ms |
| Warm Put c64 | 6,331 | 7,797 | +23.2% | 26.08 ms -> 20.25 ms |
| Cold Mixed c64 | 9,930 | 13,415 | +35.1% | 22.99 ms -> 16.50 ms |
| Warm Mixed c64 | 8,671 | 12,424 | +43.3% | 27.02 ms -> 23.74 ms |

20 个 case 的吞吐量均高于旧矩阵。写入与 Mixed 的 P99 大多同时下降，说明收益不是通过牺牲尾延迟换取。完整结果位于：

```text
results/myetcd-single-decode-matrix-20260901/
```

## 我为什么没有及时把握住方向

### 1. 只看了局部功能，没有画完整数据流

分类函数需要知道请求类型，Apply 函数需要请求内容；分别看，两次解码都有合理的局部理由。沿着同一条日志看，才会发现解析结果没有向下传递。

### 2. 把“小改动”当成了“低风险改动”

这个改动没有破坏正确性测试，却位于 Raft 日志的高频串行路径。性能敏感度取决于执行频率和所在阶段，不取决于 diff 大小。

### 3. 先围绕硬件现象讲故事，后检查软件热路径

I/O stall 可以说明请求在同步写入路径等待，但它不能解释为什么当前实现只达到另一实现约 55% 的 Put QPS。出现明显实现差距时，应同时检查 CPU、mutex/block profile、调用次数和数据流，而不是过早把“当前等待点”写成“根因”。

### 4. 没有为性能路径建立验收契约

测试只验证结果正确，没有约束每条日志的解码次数、分配量、串行阶段耗时或性能回归。因此，局部正确但重复工作的实现可以顺利通过测试。

## 最终采用的实现方向

原则是“一次解析，向下传递”：在第一次解码后保留结构化请求，分类与 Apply 共享同一结果，而不是在后续阶段重新从字节流恢复对象。

实现时仍需处理清楚：

- 解码后对象的所有权和生命周期；
- batch 中普通请求与 Compaction 的边界；
- 是否会增加长期存活对象或 GC 压力；
- 错误处理是否仍保持原有 Raft Apply 语义；
- 修改是否影响快照恢复、重放和兼容性。

## 后续 AI Coding 检查清单

以后让 AI 修改 Raft、存储、编解码或批处理路径时：

1. 先画出请求从入口、Raft、Apply 到存储提交的完整数据流。
2. 标出每一步的编码、解码、复制、分配、锁和同步 I/O。
3. 对 AI 生成的局部补丁追问：上游是否已经计算过或解析过这份数据？
4. 在正确性测试之外，增加解码调用次数或 alloc/op 的回归约束。
5. 修改前后使用相同数据集、并发度、Leader 和机器环境做 A/B。
6. 同时比较 QPS、p50/p95/p99、CPU、磁盘等待和 pprof，而不是只比较一个指标。
7. 没有 A/B 结果前，把结论写成“已发现热点”或“待验证假设”，不要写成已经确认的根因。

## 这次复盘的核心提醒

AI 很擅长生成局部自洽、能够通过测试的补丁，但它不会自动替我维护系统级方向。我的责任不是只审核每一段代码是否能工作，而是确认数据在整个链路中如何流动、昂贵工作执行了几次，以及证据能支持到什么程度。

对于性能优化，正确的顺序应当是：先建立可复现基线，再用 profile 定位热点，沿完整数据流解释热点，提出可证伪的改动，最后用 A/B 数据确认收益。
