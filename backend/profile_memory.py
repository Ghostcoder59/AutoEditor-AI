"""Simple profiler to run a command and record memory / GPU usage over time.

Usage:
  python profile_memory.py --cmd "python main.py" --timeout 30

It requires `psutil` (install with `pip install psutil`).
Produces JSON report `profile_memory_report.json` in the current folder and prints a summary.
"""

import argparse
import subprocess
import shlex
import time
import json
import shutil
import sys

try:
    import psutil
except Exception:
    print("psutil is required. Please install with: pip install psutil", file=sys.stderr)
    raise


def get_gpu_info():
    """Return GPU memory usage per GPU using nvidia-smi if available."""
    nvidia = shutil.which('nvidia-smi')
    if not nvidia:
        return None
    try:
        out = subprocess.check_output(['nvidia-smi', '--query-gpu=index,memory.used,memory.total,utilization.gpu', '--format=csv,noheader,nounits'], encoding='utf8')
        gpus = []
        for line in out.strip().splitlines():
            parts = [p.strip() for p in line.split(',')]
            if len(parts) >= 4:
                gpus.append({
                    'index': int(parts[0]),
                    'memory_used_mb': int(parts[1]),
                    'memory_total_mb': int(parts[2]),
                    'util_pct': int(parts[3]),
                })
        return gpus
    except Exception:
        return None


def monitor(proc, interval=1.0, timeout=None):
    start = time.time()
    peak = {
        'system_rss_bytes': 0,
        'proc_rss_bytes': 0,
        'gpu': {},
    }
    samples = []
    try:
        ps_proc = psutil.Process(proc.pid)
    except Exception:
        ps_proc = None

    while True:
        now = time.time()
        if timeout and (now - start) > timeout:
            try:
                proc.terminate()
            except Exception:
                pass
            break

        sys_mem = psutil.virtual_memory()
        sys_rss = getattr(sys_mem, 'used', sys_mem.total - getattr(sys_mem, 'available', 0))
        proc_rss = 0
        try:
            if ps_proc and ps_proc.is_running():
                proc_rss = ps_proc.memory_info().rss
        except Exception:
            proc_rss = 0

        gpus = get_gpu_info()
        # update peaks
        peak['system_rss_bytes'] = max(peak['system_rss_bytes'], sys_rss)
        peak['proc_rss_bytes'] = max(peak['proc_rss_bytes'], proc_rss)
        if gpus:
            for g in gpus:
                idx = str(g['index'])
                peak['gpu'].setdefault(idx, 0)
                peak['gpu'][idx] = max(peak['gpu'][idx], g.get('memory_used_mb', 0))

        samples.append({
            't': now - start,
            'system_rss_bytes': sys_rss,
            'proc_rss_bytes': proc_rss,
            'gpus': gpus,
        })

        if proc.poll() is not None:
            break
        time.sleep(interval)

    return peak, samples


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cmd', required=False, help='Command to run and profile (wrap in quotes)')
    parser.add_argument('--exe', required=False, help='Path to executable to run (avoids quoting issues)')
    parser.add_argument('--exe-args', required=False, default='', help='Arguments to pass to --exe')
    parser.add_argument('--interval', type=float, default=1.0, help='Sampling interval seconds')
    parser.add_argument('--timeout', type=float, default=30.0, help='Max run time in seconds; profiler will terminate the command after this')
    parser.add_argument('--report', default='profile_memory_report.json', help='Output JSON report file')
    args = parser.parse_args()

    cmd = args.cmd
    if not cmd and args.exe:
        # quote exe path in case it contains spaces
        cmd = f'"{args.exe}" {args.exe_args}'.strip()

    if not cmd:
        parser.error('Either --cmd or --exe must be provided')

    print(f"Starting profiling: '{cmd}' (timeout={args.timeout}s, interval={args.interval}s)")
    # start subprocess
    if args.exe:
        # launch directly to avoid shell/quoting issues
        parts = [args.exe]
        if args.exe_args:
            parts += shlex.split(args.exe_args)
        proc = subprocess.Popen(parts)
    else:
        proc = subprocess.Popen(cmd, shell=True)
    try:
        peak, samples = monitor(proc, interval=args.interval, timeout=args.timeout)
    finally:
        # ensure process is terminated
        if proc.poll() is None:
            try:
                proc.terminate()
                time.sleep(1)
                if proc.poll() is None:
                    proc.kill()
            except Exception:
                pass

    report = {
        'command': args.cmd,
        'timeout': args.timeout,
        'interval': args.interval,
        'peak': peak,
        'samples_count': len(samples),
        'samples': samples[-200:],
    }

    with open(args.report, 'w') as f:
        json.dump(report, f, indent=2)

    print('\nProfile complete. Summary:')
    print(f"  samples taken: {len(samples)}")
    print(f"  peak system used (bytes): {peak['system_rss_bytes']}")
    print(f"  peak process rss (bytes): {peak['proc_rss_bytes']}")
    if peak['gpu']:
        for k, v in peak['gpu'].items():
            print(f"  GPU {k} peak memory (MB): {v}")
    else:
        print('  GPU info: not available or nvidia-smi not found')

    print(f"Wrote report to: {args.report}")


if __name__ == '__main__':
    main()
