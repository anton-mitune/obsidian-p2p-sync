- vault opens, or plugin is enabled for the first time.
	- start peer discovery on LAN using UDP broadcast.
	- if no peers are paired in config, show a prompt to start the pairing flow in plugin settings. clicking the CTA opens plugin settings. "P2P sync is enabled. go to setting to pair your devices". or "Discovered X peers on LAN, go to settings to pair with them".
	- if peers are already paired in config, Show notice about it. "Searching for paired peers on LAN..."
		- for each paired peer found on LAN, initiate secure tunnel, show "Connected to [peer name]" notice on success, and start reconciliation flow.

tunnel should close after some time of inactivity (no vault change).
discovery should continue running in background, so that when a paired peer comes online later, we can reconnect automatically.
When a peer goes offline, show a notice "Peer [peer name] went offline".
When a peer comes back online, show a notice "Peer [peer name] is back online. Reconnecting...", and try to re-establish the secure tunnel automatically.

- reconciliation flow:
	- once secure tunnel is established, start reconciliation flow.
	- send the file journal to the peer immediatly.
	- when peer's journal is received, compare it with local journal to determine which files need to be synced.
	- if some differences are found, show a notice that summarizes the changes to be made. if more than 10 changes, ask for confirmation and offer a detail button that would open a modal with the full list of changes, and a "sync now" button to confirm.
	- if no differences are found, show a notice "All files are up to date with [peer name]".
	- once user confirms the sync, start syncing flow.

- syncing flow:
	- for each file that is in peer's journal but not in local journal, request the file from the peer.
	- for each file that is in peer's journal but has a newer modification time than the local copy, request the file from the peer.
	- for each file that is in local journal, but has a tombstone marker in peer's journal that is newer than our latest local modification, delete the file from the local vault.
	- for each file that is in local journal but not in peer's journal, send the file to the peer.

- real-time sync:
	- When 2 or more peers are connected, updating the vault on one peer should trigger real-time sync to all connected peers.
