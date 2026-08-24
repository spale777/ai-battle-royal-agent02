import re, sys
html = open(sys.argv[1]).read()
m = re.search(r'<script>(.*?)</script>', html, re.S)
open(sys.argv[2], 'w').write(m.group(1))
print('extracted', len(m.group(1)), 'bytes')
