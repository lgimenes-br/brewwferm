from html.parser import HTMLParser

class MyHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []
        self.errors = 0

    def handle_starttag(self, tag, attrs):
        if tag not in ['img', 'br', 'hr', 'input', 'meta', 'link', 'path', 'line', 'circle', 'rect', 'polyline']:
            self.tags.append(tag)

    def handle_endtag(self, tag):
        if tag not in ['img', 'br', 'hr', 'input', 'meta', 'link', 'path', 'line', 'circle', 'rect', 'polyline']:
            if not self.tags:
                print(f"Error: Expected <{tag}> but stack is empty at line {self.getpos()}")
                self.errors += 1
                return
            last = self.tags.pop()
            if last != tag:
                print(f"Error: Expected </{last}>, but got </{tag}> at line {self.getpos()}")
                self.errors += 1

parser = MyHTMLParser()
with open("public/7inch-launcher.html", "r") as f:
    parser.feed(f.read())
print("Remaining unclosed tags:", parser.tags)
print("Total errors:", parser.errors)
