sed -i 's@'\''--format=%at'\''@'\''--format=%at'\'', '\''--perl-regexp'\'', '\''--author=^((?!TaylorTurnerIT|copilot).)*$'\''@' test.py
