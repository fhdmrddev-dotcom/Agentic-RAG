"""303 golden compare: word/document.xml + every header/footer part must be byte-identical."""
import os, re, sys, zipfile
a, b = sys.argv[1], sys.argv[2]
bad = 0
for f in sorted(os.listdir(a)):
    if not f.endswith(".docx") or f == "default-filter.docx" and False:
        continue
    if f.endswith(".docx") and os.path.exists(os.path.join(b, f)):
        za, zb = zipfile.ZipFile(os.path.join(a, f)), zipfile.ZipFile(os.path.join(b, f))
        parts = [n for n in za.namelist() if re.match(r"word/(document|header\d*|footer\d*)\.xml$", n)]
        for n in parts:
            same = za.read(n) == zb.read(n)
            bad += not same
            print("%-28s %-22s %s" % (f, n, "IDENTICAL" if same else "DIFFERS"))
print("RESULT:", "ALL IDENTICAL" if bad == 0 else "%d PART(S) DIFFER" % bad)
sys.exit(1 if bad else 0)
