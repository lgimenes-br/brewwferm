from html.parser import HTMLParser
import sys

class MyParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []
    
    def handle_starttag(self, tag, attrs):
        if tag not in ['meta', 'link', 'br', 'hr', 'img', 'input', 'path', 'circle', 'line', 'polyline']:
            self.tags.append(tag)
            
    def handle_endtag(self, tag):
        if tag not in ['meta', 'link', 'br', 'hr', 'img', 'input', 'path', 'circle', 'line', 'polyline']:
            if not self.tags:
                print(f"Error: Closing tag <{tag}> with no open tags!")
                sys.exit(1)
            last = self.tags.pop()
            if last != tag:
                print(f"Error: Expected </{last}>, but got </{tag}>")
                # sys.exit(1)

parser = MyParser()
with open("public/7inch-launcher.html", "r") as f:
    parser.feed(f.read())

if parser.tags:
    print(f"Unclosed tags remaining: {parser.tags}")
else:
    print("HTML looks well-formed.")
