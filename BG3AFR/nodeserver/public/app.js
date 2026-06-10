document.addEventListener('DOMContentLoaded', () => {
	const button = document.getElementById('find-bg3-folder');
	const status = document.getElementById('find-bg3-status');
	const manualForm = document.getElementById('manual-bg3-form');
	const manualInput = document.getElementById('manual-bg3-path');
	const modsButton = document.getElementById('find-bg3-mods-folder');
	const modsStatus = document.getElementById('find-bg3-mods-status');
	const startDownloadButton = document.getElementById('start-download');
	const downloadStatus = document.getElementById('download-mods-status');
	const downloadProgress = document.getElementById('download-progress');
	const modDownloadList = document.getElementById('mod-download-list');
	const checklistItems = Array.from(document.querySelectorAll('.checklist .checklist-item'));

	if (!button || !status || !manualForm || !manualInput || !modsButton || !modsStatus) {
		return;
	}

	const checklistItem = document.getElementById('bg3-installation-item');
	const checkmark = checklistItem ? checklistItem.querySelector('.checkmark') : null;
	const modsChecklistItem = document.getElementById('bg3-mods-folder-item');
	const modsCheckmark = modsChecklistItem ? modsChecklistItem.querySelector('.checkmark') : null;

	function hideFindButton() {
		button.hidden = true;
		button.disabled = true;
	}

	function hideFindModsButton() {
		modsButton.hidden = true;
		modsButton.disabled = true;
	}

	function refreshChecklistProgress() {
		const firstNotDoneIndex = checklistItems.findIndex((item) => {
			return !item.classList.contains('checklist-item--checked');
		});

		checklistItems.forEach((item, index) => {
			const isDone = item.classList.contains('checklist-item--checked');
			const isNext = index === firstNotDoneIndex;

			if (!isDone && !isNext) {
				item.classList.add('checklist-item--hidden');
				item.setAttribute('aria-hidden', 'true');
			} else {
				item.classList.remove('checklist-item--hidden');
				item.removeAttribute('aria-hidden');
			}
		});
	}

	function markChecklistItemAsDone() {
		if (checkmark && checklistItem) {
			checkmark.textContent = '✓';
			checklistItem.classList.add('checklist-item--checked');
		}

		hideFindButton();
		refreshChecklistProgress();
	}

	function markModsChecklistItemAsDone() {
		if (modsCheckmark && modsChecklistItem) {
			modsCheckmark.textContent = '✓';
			modsChecklistItem.classList.add('checklist-item--checked');
		}

		hideFindModsButton();
		refreshChecklistProgress();
	}

	if (checklistItem && checklistItem.classList.contains('checklist-item--checked')) {
		hideFindButton();
	}

	if (modsChecklistItem && modsChecklistItem.classList.contains('checklist-item--checked')) {
		hideFindModsButton();
	}

	refreshChecklistProgress();

	async function hydrateChecklistFromSettings() {
		try {
			const [bg3Response, modsResponse] = await Promise.all([
				fetch('/api/settings/bg3InstallPath', { method: 'GET', cache: 'no-store' }),
				fetch('/api/settings/bg3ModsFolderPath', { method: 'GET', cache: 'no-store' }),
			]);

			if (bg3Response.ok) {
				const bg3Payload = await bg3Response.json();
				if (bg3Payload.success && bg3Payload.value && typeof bg3Payload.value === 'string') {
					markChecklistItemAsDone();
					manualForm.hidden = true;
					status.textContent = `Found Baldur's Gate 3 installation folder in settings: ${bg3Payload.value}`;
				}
			}

			if (modsResponse.ok) {
				const modsPayload = await modsResponse.json();
				if (modsPayload.success && modsPayload.value && typeof modsPayload.value === 'string') {
					markModsChecklistItemAsDone();
					modsStatus.textContent = `Found Baldur's Gate 3 Mods folder in settings: ${modsPayload.value}`;
				}
			}
		} catch {
			// Ignore startup settings load errors; manual/automatic discovery still works.
		}
	}

	hydrateChecklistFromSettings();

	button.addEventListener('click', async () => {
		button.disabled = true;
		status.textContent = 'Searching for Baldur\'s Gate 3...';

		try {
			const response = await fetch('/api/find-bg3-installation-folder', {
				method: 'POST',
			});
			const payload = await response.json();

			if (!response.ok) {
				manualForm.hidden = false;
				throw new Error(payload.message || 'The server could not find the game folder.');
			}

			markChecklistItemAsDone();
			manualForm.hidden = true;

			status.textContent = `${payload.message} ${payload.installPath}`;
		} catch (error) {
			status.textContent = error.message;
		} finally {
			button.disabled = false;
		}
	});

	manualForm.addEventListener('submit', async (event) => {
		event.preventDefault();

		const installPath = manualInput.value.trim();
		if (!installPath) {
			status.textContent = 'Please enter a folder path before saving.';
			return;
		}

		status.textContent = 'Saving manual Baldur\'s Gate 3 path...';

		try {
			const response = await fetch('/api/set-bg3-installation-folder', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ installPath }),
			});
			const payload = await response.json();

			if (!response.ok) {
				throw new Error(payload.message || 'Could not save the folder path.');
			}

			markChecklistItemAsDone();
			status.textContent = `${payload.message} ${payload.installPath}`;
		} catch (error) {
			status.textContent = error.message;
		}
	});

	modsButton.addEventListener('click', async () => {
		modsButton.disabled = true;
		modsStatus.textContent = "Finding Baldur's Gate 3 Mods folder...";

		try {
			const response = await fetch('/api/find-or-create-bg3-mods-folder', {
				method: 'POST',
			});
			const payload = await response.json();

			if (!response.ok) {
				throw new Error(payload.message || "Could not find or create Baldur's Gate 3 Mods folder.");
			}

			markModsChecklistItemAsDone();
			modsStatus.textContent = `${payload.message} ${payload.modsFolderPath}`;
		} catch (error) {
			modsStatus.textContent = error.message;
		} finally {
			modsButton.disabled = false;
		}
	});

	startDownloadButton.addEventListener('click', async () => {
		startDownloadButton.disabled = true;
		startDownloadButton.hidden = true;
		downloadStatus.textContent = 'Loading mod list...';
		downloadProgress.hidden = false;
		modDownloadList.innerHTML = '';

		try {
			const modListResponse = await fetch('/api/modiolist', { method: 'GET', cache: 'no-store' });
			const modListPayload = await modListResponse.json();

			if (!modListResponse.ok || !modListPayload.success) {
				throw new Error(modListPayload.message || 'Failed to load mod list.');
			}

			const modList = modListPayload.modioList.ModList;

			if (!Array.isArray(modList) || modList.length === 0) {
				downloadStatus.textContent = 'No mods to download.';
				return;
			}

			downloadStatus.textContent = `Starting download of ${modList.length} mods...`;

			let successCount = 0;
			let failureCount = 0;

			for (const mod of modList) {
				const modName = mod.ModName || 'Unknown Mod';
				const listItem = document.createElement('li');
				listItem.textContent = `${modName} - Downloading...`;
				listItem.id = `mod-item-${modName.replace(/[^a-z0-9]/gi, '_')}`;
				modDownloadList.appendChild(listItem);

				try {
					const downloadResponse = await fetch('/api/download-mod', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							modName: mod.ModName,
							modPage: mod.ModPage,
						}),
					});

					const downloadPayload = await downloadResponse.json();

					if (!downloadResponse.ok || !downloadPayload.success) {
						throw new Error(downloadPayload.message || 'Download failed.');
					}

					const isAlreadyDownloaded = downloadPayload.result?.alreadyDownloaded;
					const statusText = isAlreadyDownloaded ? '⬇ Already downloaded' : '✓ Downloaded';
					listItem.textContent = `${modName} - ${statusText} (${downloadPayload.result.fileName})`;
					listItem.style.color = 'green';
					successCount += 1;
				} catch (error) {
					listItem.textContent = `${modName} - ✗ Failed: ${error.message}`;
					listItem.style.color = 'red';
					failureCount += 1;
				}
			}

			downloadStatus.textContent = `Download complete. Success: ${successCount}, Failed: ${failureCount}.`;
		} catch (error) {
			downloadStatus.textContent = error.message;
			startDownloadButton.hidden = false;
			startDownloadButton.disabled = false;
		}
	});
});
