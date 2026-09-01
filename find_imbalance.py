with open("public/7inch-launcher.html", "r") as f:
    lines = f.readlines()

balance = 0
for i, line in enumerate(lines):
    opens = line.count('<div')
    closes = line.count('</div')
    balance += opens - closes
    if balance < 0:
        print(f"Negative balance reached at line {i+1}: {line.strip()}")
        print(f"Previous 10 lines:")
        for j in range(max(0, i-10), i+1):
            print(f"{j+1}: {lines[j].strip()}")
        break

print("Final balance:", balance)
