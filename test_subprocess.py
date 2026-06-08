import subprocess
r=subprocess.run(['git', 'log', '-5', '--format=%an <%ae> | %s', '--perl-regexp', '--author=^((?!TaylorTurnerIT|copilot).)*$'], capture_output=True, text=True)
print(repr(r.stdout))
