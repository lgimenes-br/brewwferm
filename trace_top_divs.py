with open("public/7inch-launcher.html", "r") as f:
    lines = f.readlines()

opens = 0
in_screen = False
for i, line in enumerate(lines):
    if 'class="screen"' in line:
        in_screen = True
        opens = 1
        print(f"{i+1}: {line.strip()}")
        continue
    
    if in_screen:
        for p in range(len(line)):
            if line[p:p+4] == '<div':
                opens += 1
                if opens == 2:
                    print(f"{i+1}: {line.strip()}")
            elif line[p:p+6] == '</div':
                opens -= 1
                if opens == 0:
                    print(f"{i+1}: {line.strip()} (SCREEN END)")
                    in_screen = False
                    break
