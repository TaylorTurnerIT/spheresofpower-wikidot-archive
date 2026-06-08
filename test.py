import subprocess
r = subprocess.run(['git', 'log', '-1', '--format=%at', '--perl-regexp', '--author=^((?!TaylorTurnerIT|copilot).)*$'], capture_output=True, text=True)
print('OUT:', r.stdout.strip())
