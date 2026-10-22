# Шаг 0. Файл, скачанный коннектором Google Drive (JSON с base64), → обычный PDF.
# python3 -I decode.py download.json manual.pdf
import json,base64,sys
d=json.load(open(sys.argv[1]))
print({k:(v if k!='content' else len(v)) for k,v in d.items()})
c=d['content']
if c.startswith('data:'): c=c.split(',',1)[1]
b=base64.b64decode(c)
open(sys.argv[2],'wb').write(b)
print(len(b), b[:8])
