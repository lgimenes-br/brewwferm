with open("public/7inch-launcher.html", "r") as f:
    lines = f.readlines()

opens = 0
for i, line in enumerate(lines):
    line_opens = line.count('<div')
    line_closes = line.count('</div')
    opens += line_opens - line_closes
    if "id=\"wizard-ui\"" in line:
        print(f"Line {i+1}: wizard-ui START, balance {opens}")
    if "id=\"launcher-ui\"" in line:
        print(f"Line {i+1}: launcher-ui START, balance {opens}")
    if "id=\"main-ui\"" in line:
        print(f"Line {i+1}: main-ui START, balance {opens}")
    
    if opens < 0:
        print(f"Negative balance at {i+1}")
