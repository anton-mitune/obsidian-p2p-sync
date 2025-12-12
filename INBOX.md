- it works well if both peers are online. But we have various problems when changes happen while a peer is offline.
- files deleted while a peer is offline are not synched properly when that peer comes back online.
- succesful pairing does not trigger sync immediatly. Only reloading Obsidian or restarting the plugin does.
- when sync does happen, it syncs all files again in both directions, not just the changed files.
- when not making changes for some time, it logs "peer removed". Making changes after this triggers a send but the other peer logs a "failed to decrypt" error.


- We have coded a lot. We need to consolidate the project:
    - produce documentation about how we've done things so far. go back to past copilot convos, and ask copilot to help produce docs.
	- there are many comments in the code that need to be addressed or improved, especially those mentioning "MVP approach"
	- we also need technical doc about the actualy implementation, including focused architecture and sequence diagrams, so the project is easier to understand for new contributors (and ourselves in the future)


// Auto-save journal every 5 minutes
this.journalSaveInterval = window.setInterval(() => {
	this.saveJournal();
}, 5 * 60 * 1000);

shouldn't we save journal on every change?


the peer went offline notice does not work well, it still tries to send files to offline peers for a long time.


we need to cleanup all thos notices.
