echo "['git', 'log', '-1', '--format=%at']" > dummy.py
sed -i 's@'\''--format=%at'\''@'\''--format=%at'\'', '\''--perl-regexp'\'', '\''--author=^((?!TaylorTurnerIT|copilot).)*$'\''@' dummy.py
cat dummy.py
