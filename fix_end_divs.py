with open("public/7inch-launcher.html", "r") as f:
    lines = f.readlines()

# Find the start of the script tag
script_idx = -1
for i, line in enumerate(lines):
    if "<script>" in line:
        script_idx = i
        break

# The lines before the script tag are:
# 724: </div>
# ...
# 728: </div>
# 729:
# 730: </div>
# 731: </div></div>
# 732:    </div>
# 733:  </div>
# We want to replace everything from the closing of app-calculadoras to the script tag
# with just two closing divs.

app_calc_end_idx = -1
for i in range(script_idx-1, -1, -1):
    if "<!-- M6: CALCULADORAS -->" in lines[i]:
        # Count forward to find the 5th closing div
        div_count = 0
        for j in range(i, script_idx):
            line_str = lines[j].strip()
            if line_str == "</div>":
                div_count += 1
                if div_count == 5:
                    app_calc_end_idx = j
                    break
        break

if app_calc_end_idx != -1:
    new_lines = lines[:app_calc_end_idx+1] + ["\n  </div>\n</div>\n\n"] + lines[script_idx:]
    with open("public/7inch-launcher.html", "w") as f:
        f.writelines(new_lines)
    print("Fixed closing divs!")
else:
    print("Could not find the end of app-calculadoras")
