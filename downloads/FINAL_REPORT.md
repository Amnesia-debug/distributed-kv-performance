# Coalesced ReadIndex final performance matrix

## Test contract

- One dedicated benchmark host and three empty 2-vCPU cluster members
- 100,000 measured requests per case, 100,000-key space, 256-byte values
- Concurrency: 8, 16, 32, 64
- Cold: Put and 70/30 linearizable Range/Put mixed workload
- Warm: Put, linearizable Range, and 70/30 mixed workload after isolated prefill
- Mixed operation and key selection use independent deterministic random streams
  with `seed=1`; every Mixed case executes the same 70,089 reads and 29,911 writes
- Pure Put and Range retain sequential key selection for historical comparability
- Every case starts from a fresh cluster; every warm case has its own prefill
- Natural leader election; no node is forced to lead
- Raft snapshot threshold: 64 MiB
- MVCC automatic compaction: 5-minute interval, 64 MiB size trigger,
  100,000 retained revisions
- Proposal group commit: 500 us / 64 entries
- Normal WAL fsync
- Concurrent linearizable reads share one unconfirmed ReadIndex quorum round

All 20 cases completed 100,000 successful operations. Across 2,000,000
successful operations there were zero final failures and 280 retry attempts.
Network error and drop counters were zero across all node samples.

The displayed matrix was produced by `kvbench`. An unmodified upstream etcd
`tools/benchmark` binary independently repeated the 12 semantically comparable
Cold/Warm Put and Warm linearizable Range cases. All 1,200,000 cross-check
requests succeeded with zero failures. Nine of twelve QPS results were within
10% of kvbench; c32 Put was 28%-33% higher with the official client. The
official run used one gRPC connection, clients equal to concurrency, and the
actual leader endpoint. Mixed was not replaced with `txn-mixed`, whose Txn and
range semantics differ from the direct KV workload. k6 results are excluded.

![Throughput matrix](charts/throughput.png)

## Performance matrix

| Case | C | QPS | Put P50 | Put P99 | Range P50 | Range P99 |
|---|---:|---:|---:|---:|---:|---:|
| Cold Put | 8 | 1,564 | 4.83 ms | 8.69 ms | - | - |
| Cold Put | 16 | 2,737 | 5.55 ms | 12.31 ms | - | - |
| Cold Put | 32 | 3,527 | 8.39 ms | 17.86 ms | - | - |
| Cold Put | 64 | 6,283 | 9.13 ms | 22.98 ms | - | - |
| Warm Put | 8 | 1,595 | 4.79 ms | 9.37 ms | - | - |
| Warm Put | 16 | 2,722 | 5.55 ms | 12.38 ms | - | - |
| Warm Put | 32 | 3,495 | 8.40 ms | 18.77 ms | - | - |
| Warm Put | 64 | 6,331 | 8.96 ms | 26.08 ms | - | - |
| Warm Range | 8 | 21,371 | - | - | 0.36 ms | 0.83 ms |
| Warm Range | 16 | 33,060 | - | - | 0.44 ms | 1.31 ms |
| Warm Range | 32 | 44,120 | - | - | 0.63 ms | 2.40 ms |
| Warm Range | 64 | 56,877 | - | - | 0.96 ms | 3.31 ms |
| Cold Mixed | 8 | 2,841 | 4.85 ms | 10.39 ms | 1.69 ms | 5.54 ms |
| Cold Mixed | 16 | 3,605 | 7.39 ms | 13.37 ms | 2.91 ms | 7.54 ms |
| Cold Mixed | 32 | 7,016 | 6.74 ms | 17.03 ms | 2.88 ms | 11.47 ms |
| Cold Mixed | 64 | 9,930 | 9.30 ms | 22.99 ms | 3.99 ms | 14.68 ms |
| Warm Mixed | 8 | 2,834 | 4.73 ms | 12.38 ms | 1.69 ms | 6.14 ms |
| Warm Mixed | 16 | 3,444 | 7.66 ms | 15.04 ms | 3.08 ms | 8.47 ms |
| Warm Mixed | 32 | 5,508 | 8.56 ms | 20.64 ms | 3.85 ms | 11.63 ms |
| Warm Mixed | 64 | 8,671 | 10.82 ms | 27.02 ms | 5.04 ms | 18.26 ms |

Cold and Warm Mixed both continue scaling through c64. Warm c64 reaches
8,671 QPS, 12.7% below Cold c64, with higher read and write tail latency.
These random-key results replace the earlier sequential Mixed measurements,
whose operation type and key region were coupled.

## C64 resource evidence

| Case | Leader | Process CPU | Average RSS | Host iowait | Disk util | I/O full PSI |
|---|---:|---:|---:|---:|---:|---:|
| Cold Put | node0 | 109% | 180 MiB | 10.9% | 22.6% | 11.53% |
| Warm Put | node2 | 116% | 386 MiB | 11.5% | 24.7% | 12.04% |
| Warm Range | node0 | 13% | 212 MiB | 1.0% | 0.3% | 0.23% |
| Cold Mixed | node0 | 123% | 87 MiB | 10.2% | 24.0% | 10.73% |
| Warm Mixed | node1 | 92% | 306 MiB | 20.8% | 48.5% | 21.67% |

The former Mixed c64 CPU/RPC feedback collapse is absent in the corrected
workload. Warm Mixed c64 has lower CPU than Cold Mixed c64 while disk
utilization, iowait, and I/O full pressure are materially higher. Its lower
throughput therefore correlates with storage pressure rather than exhausted CPU.

The eight measured Put cases produced 22 successful Raft snapshots totaling
809,964,721 bytes. Automatic MVCC compaction remained enabled throughout.

## Profiles and telemetry

Every case has profiles from all three members:

- CPU, mutex, block
- Heap before/after and cumulative allocations
- Goroutines before/after
- 5-second runtime trace
- pidstat, iostat, sar, vmstat, PSI, and Prometheus time series

All 480 compressed pprof files passed gzip validation. All 60 CPU profiles
were parsed by `go tool pprof`. Representative actual-leader CPU graphs:

- `charts/cold-put-c64-leader-cpu.svg`
- `charts/warm-put-c64-leader-cpu.svg`
- `charts/warm-range-c64-leader-cpu.svg`
- `charts/cold-mixed-c64-leader-cpu.svg`
- `charts/warm-mixed-c64-leader-cpu.svg`

Each graph has a matching `-top.txt` report. Because profiling lasts 30 seconds
while high-throughput cases may finish sooner, profile sample totals include an
idle tail; benchmark-window resource summaries should be used for utilization
comparisons.

## Artifacts

- `summary.csv` and `summary.json`: machine-readable performance matrix
- `official-crosscheck.csv`: upstream etcd Benchmark QPS and latency comparison
- `resource-summary.json`: per-case, per-node hardware summaries
- `runs/`: benchmark JSON, interval QPS, and timestamps
- `profiles/`: all raw pprof and trace files
- `timeseries/`: all raw hardware and Prometheus samples
- `charts/`: matrix charts and representative c64 leader profile graphs

Binary hashes:

- myetcd: `0111d6b1fac793c5e0f2058d1fefa9593082c7bb20ea2d2db1a85245342c08c9`
- kvbench for Put/Range: `3e2f5e33f3598ff4887f2c1d49f65f22eecf4c2cf9f5fe3bf3932cdc648916e5`
- kvbench for corrected random Mixed: `392f594822a0d64276c8f1ab707b3072b6ca6bea43dc6673e6a90f098f70da28`
- upstream etcd benchmark: `6bc5385cf4b3dfe14fbc0b43494fb52166c3bc2a8957054aa453c3dfbf24138a`
