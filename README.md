# Battle Draw

Deploy armies by hand, then watch them fight. A canvas sandbox battler with no dependencies.

## Run

```
npm start
```

Open http://localhost:3000. Change the port with `PORT=8080 npm start`.

## How a battle works

- The field starts empty. Deploy fighters wherever you like.
- Rival groups fight on contact. Nothing ends the battle on its own.
- When only one group is left, its fighters stand guard, sweeping their aim to look for enemies. Deploying a new group starts the fight again.
- Press **Finish battle** (or F) whenever you want the verdict:
  1. The group with the most fighters wins.
  2. If fighter counts tie, the group with more total health wins.
  3. If both tie, it's a draw.
- After a verdict, deploying again starts a new battle.

## Controls

- Drag to deploy. Right-drag or press E to erase. Scroll to resize the brush.
- Space: pause · F: finish battle · C: clear · Ctrl+Z: undo · 1–9: pick a unit · Tab: next category · M: mute

## Layout

- `server.js`: static file server built on Node's `http` module
- `public/js/units.js`: unit stats
- `public/js/sim.js`: battle rules, unit AI and the finish verdict (no DOM)
- `public/js/art.js`: character drawings
- `public/js/render.js`: canvas drawing
- `public/js/main.js`: UI, input, sound, game loop
- `public/styles.css`: interface styling
