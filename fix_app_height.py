with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

# Remove height: 100%; from inline styles of app-containers
html = html.replace('style="display: none; height: 100%; position: relative;"', 'style="display: none; position: relative;"')

# Also, check if there are any other height issues.
# .views-wrapper has style="height: calc(100% - 50px); overflow: hidden;"
# .views-wrapper is a flex child? No, .app-container is flex: 1, flex-direction: column.
# If .views-wrapper has height: calc(100% - 50px), it might be better to just use flex: 1 on .views-wrapper and give .pagination a fixed height!
# Let's fix this properly.
# .app-container is display: flex; flex-direction: column;
# So .views-wrapper can just be `flex: 1; min-height: 0;`.
# And .pagination can be `height: 50px; display: flex; align-items: center; justify-content: center;`.
# No absolute positioning needed!
html = html.replace('style="height: calc(100% - 50px); overflow: hidden;"', 'style="flex: 1; min-height: 0; overflow: hidden;"')
html = html.replace('style="position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); display: flex; gap: 12px;"', 'style="height: 50px; display: flex; align-items: center; justify-content: center; gap: 12px; flex-shrink: 0;"')
html = html.replace('style="position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px;"', 'style="height: 50px; display: flex; align-items: center; justify-content: center; gap: 12px; flex-shrink: 0;"')
html = html.replace('style="position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px;"', 'style="height: 50px; display: flex; align-items: center; justify-content: center; gap: 12px; flex-shrink: 0;"')

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
print("Flexbox constraints fixed!")
