# Frimout: Journey to the Stars

A browser platform game paying tribute to Dirk Frimout, the first Belgian in space. He flew as a payload specialist on Space Shuttle Atlantis mission STS-45 (24 March to 2 April 1992), working with the ATLAS-1 atmospheric laboratory.

The game follows his path in five chapters:

1. **Poperinge** (1941): his birthplace in the hop country of West Flanders.
2. **Ghent University** (1963 to 1970): electronics engineer, then a doctorate in applied physics.
3. **European Space Agency** (1978 to 1984): on the road to being selected for ATLAS-1.
4. **Launch Pad 39A** (24 March 1992): climb the tower to the crew hatch, followed by a liftoff cutscene.
5. **In Orbit with ATLAS-1**: low gravity, followed by the landing at Kennedy Space Center.

The hero sprite is drawn after his 1992 NASA crew portrait: bald crown, a ring of grey hair, a moustache, the orange launch-and-entry suit and a Belgian flag patch.

## Controls

| Action | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Move | Arrows / A D | D-pad / left stick | Arrow buttons |
| Jump (hold for higher) | Space / Up / W / Z | A / B | Jump button |
| Confirm | Enter | A / Start | Tap the screen |
| Pause | P / Esc | Start | Pause button |
| Sound on/off | M | | |

Progress (the furthest chapter reached) and the sound setting are stored in the browser's local storage.

## Running locally

The game is plain HTML, CSS and JavaScript modules with no build step and no dependencies. ES modules don't load over `file://`, so serve the folder over HTTP:

```sh
npm run serve
```

Then open http://localhost:8000. Add `?chapter=N` (1 to 5) to the URL to jump straight to a chapter.

## Level checker

```sh
npm run check
```

This loads every level with the game's real player physics and explores, breadth-first, every place the player can stand by simulating a fan of jump and steering inputs. It fails if the goal, any collectible or any checkpoint is unreachable. Enemies are ignored and steam vents are treated as passable, since both can be waited out. Add `--map` (`node tools/check-levels.js --map`) to print a failing level with the reachable standing spots marked `*`.

The GitHub Pages workflow runs this check before every deploy.

## Editing levels

Levels are ASCII maps in `js/levels.js`. Each character is one 16x16 tile:

| Char | Meaning | Char | Meaning |
| --- | --- | --- | --- |
| `#` | solid ground | `=` | solid block / girder |
| `-` | one-way platform | `^` | spikes |
| `o` | collectible | `B` | spring |
| `C` | checkpoint | `G` | goal |
| `S` | player start | `E` | walking enemy |
| `F` | flying enemy | `V` | steam vent (timed hazard) |
| `.` | empty | | |

All rows of a map must be the same length. At normal gravity the player clears about 3 tiles up and 4 tiles across; in orbit, about 4 up and 6 across. Run `npm run check` after every change.

## Deploying to GitHub Pages

1. Push this repository to GitHub, with `main` as the default branch.
2. In the repository, go to **Settings > Pages** and set **Source** to **GitHub Actions**.
3. Every push to `main` runs `.github/workflows/pages.yml`, which checks the levels, packages `index.html`, `favicon.svg`, `css/` and `js/`, and publishes them. The site appears at `https://<user>.github.io/<repository>/`.

All asset paths are relative, so the game works from a project subpath.

## Project layout

```
index.html          page shell and touch controls
css/style.css       layout and touch button styling
js/main.js          game states, loop, camera, HUD, screens and cutscenes
js/levels.js        chapter texts and level maps
js/world.js         tile map, collision helpers, hazards
js/player.js        player physics (pure, also used by the checker)
js/entities.js      enemies, collectibles, checkpoints
js/render.js        backgrounds, tiles, enemies, shuttle drawings
js/sprites.js       hero sprite and portrait
js/input.js         keyboard, touch and gamepad input
js/audio.js         synthesised sound effects and music
tools/check-levels.js  level reachability checker
```

## Sources

- Biography: [Britannica](https://www.britannica.com/biography/Dirk-Frimout), [BIRA-IASB](https://bira-iasb.be/en/encyclopedia/dirk-frimout-atmospheric-scientist-first-belgian-astronaut), [Spacefacts](https://spacefacts.de/bios/international/english/frimout_dirk.htm)
- Mission: [NASA STS-45](https://www.nasa.gov/mission/sts-45), [ESA Atlas-1](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Atlas-1)
- Likeness reference: [NASA crew portrait on Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Frimout.jpg)

## License

The code is released under the [MIT License](LICENSE).

## Disclaimer

This is a fan-made tribute. It is not affiliated with or endorsed by Dirk Frimout, NASA or ESA. All graphics and sounds are generated in code; the font is [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) (SIL Open Font License), loaded from Google Fonts.
