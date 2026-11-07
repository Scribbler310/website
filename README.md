# Website

A small games website in plain HTML, CSS, and JavaScript. There's nothing to install or build.

## Getting started

```sh
git clone https://github.com/Scribbler310/website.git
```

Then open `website.html` in your browser. To put the site online, upload `website.html`, `styles.css`, and `script.js` to any static host.

## Adding a game

1. Write a function that draws the game into an element and returns a function that stops it. `mountSunwheel` is an example.
2. Add an entry to the `GAMES` list near the bottom of `script.js`.

The navbar link, home page card, and `#/games/<slug>` page all come from that list.
