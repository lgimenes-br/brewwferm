with open("public/7inch-launcher.html", "r") as f:
    lines = f.readlines()

opens = 0
for i in range(711, 740):
    line = lines[i].strip()
    if not line: continue
    print(f"{i+1:3d}: {line}")
