# Man of the Match

Mobile-first static web app for Harbord FC match voting, designed for Netlify deployment without a backend or database.

## Local development

```bash
npm run dev
```

Open <http://localhost:5173> in a browser. To test on an iPhone, connect the phone to the same Wi-Fi network and open `http://YOUR_COMPUTER_IP:5173`.

## Build

```bash
npm run build
```

Netlify uses `netlify.toml` to publish the generated `dist` folder.

## Preview the production build

```bash
npm run preview
```

Open <http://localhost:4173>.

## Manual test checklist

1. Confirm all 23 default players are shown on the setup screen.
2. Add goals and assists for a player, then start voting and confirm the ball and boot icons appear next to that player.
3. Save two valid votes, delete one vote, and confirm the leaderboard updates.
4. Start a new match to save the completed game into Records.
5. Open Records and confirm season votes, goal scorers, assists, and saved games are listed.
6. Delete a saved game and confirm its votes, goals, and assists are removed from the Records totals.
7. Refresh the browser during an active match and confirm the match is still available.
