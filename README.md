# Frimout Arcade

Browser mini-games paying tribute to Dirk Frimout, the first Belgian in space. He flew as a payload specialist on Space Shuttle Atlantis mission STS-45 (24 March to 2 April 1992), working with the ATLAS-1 atmospheric laboratory.

The site opens on a game-selection menu. The hero is drawn after his 1992 NASA crew portrait: bald crown, a ring of grey hair, a moustache, the orange launch-and-entry suit and a Belgian flag patch.

## The games

### Journey to the Stars (platformer)

Five chapters following his path:

1. **Poperinge** (1941): his birthplace in the hop country of West Flanders.
2. **Ghent University** (1963 to 1970): electronics engineer, then a doctorate in applied physics.
3. **European Space Agency** (1978 to 1984): on the road to being selected for ATLAS-1.
4. **Launch Pad 39A** (24 March 1992): climb the tower to the crew hatch, followed by a liftoff cutscene.
5. **In Orbit with ATLAS-1**: low gravity, followed by the landing at Kennedy Space Center.

### Frimout 3D: Lab Lockdown (first-person action)

A fictional training run in an orbital-lab simulator, presented as fiction in the game itself. The lab's maintenance robots have glitched; switch them off with a repair zapper (three hits each), recover the data disks and reach the green exit hatch. Three decks, sliding doors, Belgian waffles for health and energy cells for the zapper. It is an original raycaster in the first-person genre, not a remake of any existing game.

## Controls

| Action | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Menu: choose / select | Up Down / Enter | D-pad / A | Arrow buttons / A or tap |
| Pause menu (Resume, Quit to menu) | Esc / P | Start | II |
| Back to game menu (from a game's title) | Esc | Start | II |
| Sound on/off | M | | |

**Journey to the Stars**

| Action | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Move | Left Right / A D | D-pad / left stick | Left Right |
| Jump (hold for higher) | Space / Up / W / Z | A / B | A |

**Lab Lockdown**

| Action | Keyboard / mouse | Gamepad | Touch |
| --- | --- | --- | --- |
| Move forward / back | W S / Up Down | D-pad / stick up down | Up Down |
| Turn | Left Right, or mouse (click the screen to capture it) | D-pad / stick left right | Left Right |
| Strafe | A D | LB RB | |
| Zap | Space / Ctrl / F / left click | A / RT | A |

Progress (furthest chapter or deck reached per game), the last selected game and the sound setting are stored in the browser's local storage.

## Running locally

Plain HTML, CSS and JavaScript modules, with no build step and no dependencies. ES modules don't load over `file://`, so serve the folder over HTTP:

```sh
npm run serve
```

Then open http://localhost:8000.

URL parameters open a game directly: `?game=journey&chapter=N` (1 to 5) or `?game=lockdown&map=N` (1 to 3). The older `?chapter=N` links still open Journey to the Stars.

## Level checks

```sh
npm run check
```

- `tools/check-journey.js` loads every platformer level with the game's real player physics and explores, breadth-first, every place the player can stand by simulating a fan of jump and steering inputs. It fails if the goal, any collectible or any checkpoint is unreachable. Enemies are ignored and steam vents are treated as passable, since both can be waited out. Add `--map` (`node tools/check-journey.js --map`) to print a failing level with the reachable standing spots marked `*`.
- `tools/check-lockdown.js` parses every Lab Lockdown map (row lengths, tiles, door orientation) and checks that the exit, every pickup and every robot can be reached on foot.

The GitHub Pages workflow runs these checks before every deploy.

## Editing levels

### Journey to the Stars: `js/games/journey/levels.js`

Each character is one 16x16 tile:

| Char | Meaning | Char | Meaning |
| --- | --- | --- | --- |
| `#` | solid ground | `=` | solid block / girder |
| `-` | one-way platform | `^` | spikes |
| `o` | collectible | `B` | spring |
| `C` | checkpoint | `G` | goal |
| `S` | player start | `E` | walking enemy |
| `F` | flying enemy | `V` | steam vent (timed hazard) |
| `.` | empty | | |

At normal gravity the player clears about 3 tiles up and 4 tiles across; in orbit, about 4 up and 6 across.

### Lab Lockdown: `js/games/lockdown/maps.js`

| Char | Meaning | Char | Meaning |
| --- | --- | --- | --- |
| `#` | wall panel | `R` | computer rack |
| `W` | window | `P` | pipes |
| `F` | Belgian flag wall | `D` | sliding door (must sit between two walls) |
| `X` | exit hatch | `.` | floor |
| `@` | player start | `r` | robot |
| `d` | data disk | `h` | waffle (+25 health) |
| `e` | energy cell | | |

In both games every row of a map must be the same length. Run `npm run check` after every change.

## Adding a game

Register it in `js/games/index.js`. A game is a `create(shell, params)` factory returning an object with `update(dt)`, `drawPixels(ctx)` (480x270 pixel canvas), `drawOverlay(ctx)` (full-resolution text layer in the same units), `pausable`, `touchLayout` (`"platform"`, `"fps"` or `"menu"`), `onPause()`, `onResume()` and `dispose()`. The shell provides `input`, `sound`, `canvas`, `exit()` and `pause()`; the comment at the top of `js/games/index.js` documents the contract.

## Deploying to GitHub Pages

1. Push this repository to GitHub, with `main` as the default branch.
2. In the repository, go to **Settings > Pages** and set **Source** to **GitHub Actions**.
3. Every push to `main` runs `.github/workflows/pages.yml`, which runs the checks, packages `index.html`, `favicon.svg`, `css/` and `js/`, and publishes them. The site appears at `https://<user>.github.io/<repository>/`.

All asset paths are relative, so the site works from a project subpath.

## Project layout

```
index.html                 page shell and touch controls
css/style.css              layout and touch button styling (per-context layouts)
js/main.js                 shell: loop, game-selection menu, pause menu, scaling
js/core/                   shared: input, bindings, audio, text, sprites, storage, backdrop
js/games/index.js          game registry and the game contract
js/games/journey/          Journey to the Stars (platformer)
js/games/lockdown/         Frimout 3D: Lab Lockdown (raycaster, maps, textures)
tools/check-journey.js     platformer reachability checker
tools/check-lockdown.js    Lab Lockdown map checker
```

## Sources

- Biography: [Britannica](https://www.britannica.com/biography/Dirk-Frimout), [BIRA-IASB](https://bira-iasb.be/en/encyclopedia/dirk-frimout-atmospheric-scientist-first-belgian-astronaut), [Spacefacts](https://spacefacts.de/bios/international/english/frimout_dirk.htm)
- Mission: [NASA STS-45](https://www.nasa.gov/mission/sts-45), [ESA Atlas-1](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Atlas-1)
- Likeness reference: [NASA crew portrait on Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Frimout.jpg)

## License

The code is released under the [MIT License](LICENSE).

## Disclaimer

This is a fan-made tribute. It is not affiliated with or endorsed by Dirk Frimout, NASA or ESA. Lab Lockdown's story is fiction. All graphics and sounds are generated in code; the font is [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) (SIL Open Font License), loaded from Google Fonts.
