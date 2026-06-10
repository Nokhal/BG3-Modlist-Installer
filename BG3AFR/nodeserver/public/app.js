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
	const toggleModListButton = document.getElementById('toggle-mod-list');
	const downloadModsItem = document.getElementById('download-mods-item');
	const downloadModsCheckmark = downloadModsItem ? downloadModsItem.querySelector('.checkmark') : null;
	const startExtractButton = document.getElementById('start-extract');
	const extractStatus = document.getElementById('extract-packages-status');
	const extractProgress = document.getElementById('extract-progress');
	const extractList = document.getElementById('extract-list');
	const toggleExtractListButton = document.getElementById('toggle-extract-list');
	const extractPackagesItem = document.getElementById('extract-packages-item');
	const extractPackagesCheckmark = extractPackagesItem ? extractPackagesItem.querySelector('.checkmark') : null;
	const startDownloadRpghqButton = document.getElementById('start-download-rpghq');
	const downloadRpghqStatus = document.getElementById('download-rpghq-status');
	const downloadRpghqProgress = document.getElementById('download-rpghq-progress');
	const rpghqDownloadList = document.getElementById('rpghq-download-list');
	const toggleRpghqListButton = document.getElementById('toggle-rpghq-list');
	const downloadRpghqItem = document.getElementById('download-rpghq-item');
	const downloadRpghqCheckmark = downloadRpghqItem ? downloadRpghqItem.querySelector('.checkmark') : null;
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
			const [bg3Response, modsResponse, modioDownloadResponse, rpghqDownloadResponse, modsExtractedResponse] = await Promise.all([
				fetch('/api/settings/bg3InstallPath', { method: 'GET', cache: 'no-store' }),
				fetch('/api/settings/bg3ModsFolderPath', { method: 'GET', cache: 'no-store' }),
				fetch('/api/settings/modiodownload', { method: 'GET', cache: 'no-store' }),
				fetch('/api/settings/rpghqdownload', { method: 'GET', cache: 'no-store' }),
				fetch('/api/settings/modsextracted', { method: 'GET', cache: 'no-store' }),
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

			if (modioDownloadResponse.ok) {
				const modioPayload = await modioDownloadResponse.json();
				if (modioPayload.success && modioPayload.value === true) {
					if (downloadModsCheckmark && downloadModsItem) {
						downloadModsCheckmark.textContent = '✓';
						downloadModsItem.classList.add('checklist-item--checked');
					}
					downloadStatus.textContent = 'Mods downloaded previously.';
					startDownloadButton.hidden = true;
					startDownloadButton.disabled = true;
					await displayAlreadyDownloadedMods();
				}
			}

			if (rpghqDownloadResponse.ok) {
				const rpghqPayload = await rpghqDownloadResponse.json();
				if (rpghqPayload.success && rpghqPayload.value === true) {
					if (downloadRpghqCheckmark && downloadRpghqItem) {
						downloadRpghqCheckmark.textContent = '✓';
						downloadRpghqItem.classList.add('checklist-item--checked');
					}
					downloadRpghqStatus.textContent = 'Mods downloaded previously.';
					startDownloadRpghqButton.hidden = true;
					startDownloadRpghqButton.disabled = true;
					await displayAlreadyDownloadedRpghqMods();
				}
			}

			if (modsExtractedResponse.ok) {
				const extractedPayload = await modsExtractedResponse.json();
				if (extractedPayload.success && extractedPayload.value === true) {
					if (extractPackagesCheckmark && extractPackagesItem) {
						extractPackagesCheckmark.textContent = '✓';
						extractPackagesItem.classList.add('checklist-item--checked');
					}
					extractStatus.textContent = 'Mods extracted previously.';
					startExtractButton.hidden = true;
					startExtractButton.disabled = true;
					await displayAlreadyExtractedMods();
				}
			}
		} catch {
			// Ignore startup settings load errors; manual/automatic discovery still works.
		}
	}

	hydrateChecklistFromSettings().then(() => {
		refreshChecklistProgress();
	});

	// localStorage helpers for persisting collapse state
	function saveDownloadListCollapsedState(isCollapsed) {
		localStorage.setItem('downloadListCollapsed', JSON.stringify(isCollapsed));
	}

	function loadDownloadListCollapsedState() {
		const saved = localStorage.getItem('downloadListCollapsed');
		return saved !== null ? JSON.parse(saved) : false;
	}

	function saveExtractListCollapsedState(isCollapsed) {
		localStorage.setItem('extractListCollapsed', JSON.stringify(isCollapsed));
	}

	function loadExtractListCollapsedState() {
		const saved = localStorage.getItem('extractListCollapsed');
		return saved !== null ? JSON.parse(saved) : false;
	}

	function applyDownloadListCollapsedState() {
		const isCollapsed = loadDownloadListCollapsedState();
		if (isCollapsed) {
			modDownloadList.classList.add('collapsed');
			toggleModListButton.textContent = '▶ Show Downloads';
		} else {
			modDownloadList.classList.remove('collapsed');
			toggleModListButton.textContent = '▼ Hide Downloads';
		}
	}

	function applyExtractListCollapsedState() {
		const isCollapsed = loadExtractListCollapsedState();
		if (isCollapsed) {
			extractList.classList.add('collapsed');
			toggleExtractListButton.textContent = '▶ Show Extractions';
		} else {
			extractList.classList.remove('collapsed');
			toggleExtractListButton.textContent = '▼ Hide Extractions';
		}
	}

	function saveRpghqListCollapsedState(isCollapsed) {
		localStorage.setItem('rpghqListCollapsed', JSON.stringify(isCollapsed));
	}

	function loadRpghqListCollapsedState() {
		const saved = localStorage.getItem('rpghqListCollapsed');
		return saved !== null ? JSON.parse(saved) : false;
	}

	function applyRpghqListCollapsedState() {
		const isCollapsed = loadRpghqListCollapsedState();
		if (isCollapsed) {
			rpghqDownloadList.classList.add('collapsed');
			toggleRpghqListButton.textContent = '▶ Show Downloads';
		} else {
			rpghqDownloadList.classList.remove('collapsed');
			toggleRpghqListButton.textContent = '▼ Hide Downloads';
		}
	}

	async function displayAlreadyDownloadedMods() {
		try {
			downloadProgress.hidden = false;
			modDownloadList.innerHTML = '';
			downloadStatus.textContent = 'Loading previously downloaded mods...';
			toggleModListButton.hidden = true;

			const modListResponse = await fetch('/api/modiolist', { method: 'GET', cache: 'no-store' });
			const modListPayload = await modListResponse.json();

			if (!modListResponse.ok || !modListPayload.success) {
				throw new Error(modListPayload.message || 'Failed to load mod list.');
			}

			const modList = modListPayload.modioList.ModList;
			const downloadedMods = modList.filter((mod) => mod.filename && mod.source === 'mod.io');

			if (downloadedMods.length === 0) {
				downloadStatus.textContent = 'No previously downloaded mods found.';
				return;
			}

			downloadStatus.textContent = `Showing ${downloadedMods.length} previously downloaded mods...`;

			for (const mod of downloadedMods) {
				const modName = mod.ModName || 'Unknown Mod';
				const filename = mod.filename || 'Unknown';
				const listItem = document.createElement('li');
				listItem.textContent = `${modName} - ⬇ Already downloaded (${filename})`;
				listItem.id = `mod-item-${modName.replace(/[^a-z0-9]/gi, '_')}`;
				listItem.style.color = 'green';
				modDownloadList.appendChild(listItem);
			}

			downloadStatus.textContent = `Showing ${downloadedMods.length} previously downloaded mods.`;
			toggleModListButton.hidden = false;
			applyDownloadListCollapsedState();
		} catch (error) {
			downloadStatus.textContent = `Error loading downloaded mods: ${error.message}`;
		}
	}

	async function displayAlreadyDownloadedRpghqMods() {
		try {
			downloadRpghqProgress.hidden = false;
			rpghqDownloadList.innerHTML = '';
			downloadRpghqStatus.textContent = 'Loading previously downloaded mods...';
			toggleRpghqListButton.hidden = true;

			const modListResponse = await fetch('/api/modiolist', { method: 'GET', cache: 'no-store' });
			const modListPayload = await modListResponse.json();

			if (!modListResponse.ok || !modListPayload.success) {
				throw new Error(modListPayload.message || 'Failed to load mod list.');
			}

			const modList = modListPayload.modioList.ModList;
			const downloadedRpghqMods = modList.filter((mod) => mod.filename && mod.source === 'rpghq.org');

			if (downloadedRpghqMods.length === 0) {
				downloadRpghqStatus.textContent = 'No previously downloaded rpghq.org mods found.';
				return;
			}

			downloadRpghqStatus.textContent = `Showing ${downloadedRpghqMods.length} previously downloaded mods...`;

			for (const mod of downloadedRpghqMods) {
				const modName = mod.ModName || 'Unknown Mod';
				const filename = mod.filename || 'Unknown';
				const listItem = document.createElement('li');
				listItem.textContent = `${modName} - ⬇ Already downloaded (${filename})`;
				listItem.id = `rpghq-item-${modName.replace(/[^a-z0-9]/gi, '_')}`;
				listItem.style.color = 'green';
				rpghqDownloadList.appendChild(listItem);
			}

			downloadRpghqStatus.textContent = `Showing ${downloadedRpghqMods.length} previously downloaded mods.`;
			toggleRpghqListButton.hidden = false;
			applyRpghqListCollapsedState();
		} catch (error) {
			downloadRpghqStatus.textContent = `Error loading downloaded mods: ${error.message}`;
		}
	}

	async function displayAlreadyExtractedMods() {
		try {
			extractProgress.hidden = false;
			extractList.innerHTML = '';
			extractStatus.textContent = 'Loading previously extracted mods...';
			toggleExtractListButton.hidden = true;

			const modListResponse = await fetch('/api/modiolist', { method: 'GET', cache: 'no-store' });
			const modListPayload = await modListResponse.json();

			if (!modListResponse.ok || !modListPayload.success) {
				throw new Error(modListPayload.message || 'Failed to load mod list.');
			}

			const modList = modListPayload.modioList.ModList;
			const extractedMods = modList.filter((mod) => mod.pakfile);

			if (extractedMods.length === 0) {
				extractStatus.textContent = 'No previously extracted mods found.';
				return;
			}

			extractStatus.textContent = `Showing ${extractedMods.length} previously extracted mods...`;

			for (const mod of extractedMods) {
				const modName = mod.ModName || 'Unknown Mod';
				const pakfile = mod.pakfile || 'Unknown';
				const listItem = document.createElement('li');
				listItem.textContent = `${modName} - ⬇ Already extracted (${pakfile})`;
				listItem.id = `extract-item-${modName.replace(/[^a-z0-9]/gi, '_')}`;
				listItem.style.color = 'green';
				extractList.appendChild(listItem);
			}

			extractStatus.textContent = `Showing ${extractedMods.length} previously extracted mods.`;
			toggleExtractListButton.hidden = false;
			applyExtractListCollapsedState();
		} catch (error) {
			extractStatus.textContent = `Error loading extracted mods: ${error.message}`;
		}
	}

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
		toggleModListButton.hidden = true;

		try {
			const modListResponse = await fetch('/api/modiolist', { method: 'GET', cache: 'no-store' });
			const modListPayload = await modListResponse.json();

			if (!modListResponse.ok || !modListPayload.success) {
				throw new Error(modListPayload.message || 'Failed to load mod list.');
			}

			const modList = modListPayload.modioList.ModList;

			// Filter to only mod.io mods
			const mod_io_mods = modList.filter(mod => mod.source === 'mod.io');

			if (!Array.isArray(mod_io_mods) || mod_io_mods.length === 0) {
				downloadStatus.textContent = 'No mod.io mods to download.';
				return;
			}

			downloadStatus.textContent = `Starting download of ${mod_io_mods.length} mods...`;

			let successCount = 0;
			let failureCount = 0;

			for (const mod of mod_io_mods) {
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

			// Mark the download task as checked
			if (downloadModsCheckmark && downloadModsItem) {
				downloadModsCheckmark.textContent = '✓';
				downloadModsItem.classList.add('checklist-item--checked');
			}
		// Update settings to mark modiodownload as complete
		try {
			const settingsResponse = await fetch('/api/settings/modiodownload', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ value: true }),
			});

			if (!settingsResponse.ok) {
				console.error('Failed to update modiodownload setting');
			}
		} catch (error) {
			console.error('Error updating modiodownload setting:', error);
		}
		// Refresh checklist to show next step
		refreshChecklistProgress();
			// Show the toggle button
			toggleModListButton.hidden = false;
			applyDownloadListCollapsedState();
		} catch (error) {
			downloadStatus.textContent = error.message;
			startDownloadButton.hidden = false;
			startDownloadButton.disabled = false;
		}
	});

	toggleModListButton.addEventListener('click', () => {
		const isCollapsed = modDownloadList.classList.contains('collapsed');
		if (isCollapsed) {
			modDownloadList.classList.remove('collapsed');
			toggleModListButton.textContent = '▼ Hide Downloads';
		} else {
			modDownloadList.classList.add('collapsed');
			toggleModListButton.textContent = '▶ Show Downloads';
		}
		saveDownloadListCollapsedState(!isCollapsed);
	});

	startExtractButton.addEventListener('click', async () => {
		startExtractButton.disabled = true;
		startExtractButton.hidden = true;
		extractStatus.textContent = 'Loading mod list...';
		extractProgress.hidden = false;
		extractList.innerHTML = '';
		toggleExtractListButton.hidden = true;

		try {
			const modListResponse = await fetch('/api/modiolist', { method: 'GET', cache: 'no-store' });
			const modListPayload = await modListResponse.json();

			if (!modListResponse.ok || !modListPayload.success) {
				throw new Error(modListPayload.message || 'Failed to load mod list.');
			}

			const modList = modListPayload.modioList.ModList;

			if (!Array.isArray(modList) || modList.length === 0) {
				extractStatus.textContent = 'No mods to extract.';
				return;
			}

			const modsToExtract = modList.filter((mod) => mod.filename);
			if (modsToExtract.length === 0) {
				extractStatus.textContent = 'No mods with filenames found to extract.';
				return;
			}

			extractStatus.textContent = `Starting extraction of ${modsToExtract.length} mods...`;

			let successCount = 0;
			let failureCount = 0;

			for (const mod of modsToExtract) {
				const modName = mod.ModName || 'Unknown Mod';
				const filename = mod.filename;
				const listItem = document.createElement('li');
				listItem.textContent = `${modName} - Extracting...`;
				listItem.id = `extract-item-${modName.replace(/[^a-z0-9]/gi, '_')}`;
				extractList.appendChild(listItem);

				try {
					const extractResponse = await fetch('/api/extract-mod', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							modArchiveFilename: filename,
						}),
					});

					const extractPayload = await extractResponse.json();

					if (!extractResponse.ok || !extractPayload.success) {
						throw new Error(extractPayload.message || 'Extraction failed.');
					}

					const isAlreadyExtracted = extractPayload.result?.alreadyExtracted;
					const statusText = isAlreadyExtracted ? '⬇ Already extracted' : '✓ Extracted';
					listItem.textContent = `${modName} - ${statusText} (${filename})`;
					listItem.style.color = 'green';
					successCount += 1;
				} catch (error) {
					listItem.textContent = `${modName} - ✗ Failed: ${error.message}`;
					listItem.style.color = 'red';
					failureCount += 1;
				}
			}

			extractStatus.textContent = `Extraction complete. Success: ${successCount}, Failed: ${failureCount}.`;

			// Mark the extract task as checked
			if (extractPackagesCheckmark && extractPackagesItem) {
				extractPackagesCheckmark.textContent = '✓';
				extractPackagesItem.classList.add('checklist-item--checked');
			}
		// Update settings to mark modsextracted as complete
		try {
			const settingsResponse = await fetch('/api/settings/modsextracted', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ value: true }),
			});

			if (!settingsResponse.ok) {
				console.error('Failed to update modsextracted setting');
			}
		} catch (error) {
			console.error('Error updating modsextracted setting:', error);
		}
			// Refresh checklist to hide completed step
			refreshChecklistProgress();

			// Show the toggle button
			toggleExtractListButton.hidden = false;
			applyExtractListCollapsedState();
		} catch (error) {
			extractStatus.textContent = error.message;
			startExtractButton.hidden = false;
			startExtractButton.disabled = false;
		}
	});

	toggleExtractListButton.addEventListener('click', () => {
		const isCollapsed = extractList.classList.contains('collapsed');
		if (isCollapsed) {
			extractList.classList.remove('collapsed');
			toggleExtractListButton.textContent = '▼ Hide Extractions';
		} else {
			extractList.classList.add('collapsed');
			toggleExtractListButton.textContent = '▶ Show Extractions';
		}
		saveExtractListCollapsedState(!isCollapsed);
	});

	startDownloadRpghqButton.addEventListener('click', async () => {
		startDownloadRpghqButton.disabled = true;
		startDownloadRpghqButton.hidden = true;
		downloadRpghqStatus.textContent = 'Loading mod list...';
		downloadRpghqProgress.hidden = false;
		rpghqDownloadList.innerHTML = '';
		toggleRpghqListButton.hidden = true;

		try {
			const modListResponse = await fetch('/api/modiolist', { method: 'GET', cache: 'no-store' });
			const modListPayload = await modListResponse.json();

			if (!modListResponse.ok || !modListPayload.success) {
				throw new Error(modListPayload.message || 'Failed to load mod list.');
			}

			const modList = modListPayload.modioList.ModList;

			// Filter to only rpghq.org mods
			const rpghqMods = modList.filter(mod => mod.source === 'rpghq.org');

			if (!Array.isArray(rpghqMods) || rpghqMods.length === 0) {
				downloadRpghqStatus.textContent = 'No rpghq.org mods to download.';
				return;
			}

			downloadRpghqStatus.textContent = `Starting download of ${rpghqMods.length} mods...`;

			let successCount = 0;
			let failureCount = 0;

			for (const mod of rpghqMods) {
				const modName = mod.ModName || 'Unknown Mod';
				const listItem = document.createElement('li');
				listItem.textContent = `${modName} - Downloading...`;
				listItem.id = `rpghq-item-${modName.replace(/[^a-z0-9]/gi, '_')}`;
				rpghqDownloadList.appendChild(listItem);

				try {
					const downloadResponse = await fetch('/api/download-mod', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							modName: mod.ModName,
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

			downloadRpghqStatus.textContent = `Download complete. Success: ${successCount}, Failed: ${failureCount}.`;

			// Mark the download task as checked
			if (downloadRpghqCheckmark && downloadRpghqItem) {
				downloadRpghqCheckmark.textContent = '✓';
				downloadRpghqItem.classList.add('checklist-item--checked');
			}

			// Update settings to mark rpghqdownload as complete
			try {
				const settingsResponse = await fetch('/api/settings/rpghqdownload', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ value: true }),
				});

				if (!settingsResponse.ok) {
					console.error('Failed to update rpghqdownload setting');
				}
			} catch (error) {
				console.error('Error updating rpghqdownload setting:', error);
			}

			// Refresh checklist to show next step
			refreshChecklistProgress();

			// Show the toggle button
			toggleRpghqListButton.hidden = false;
			applyRpghqListCollapsedState();
		} catch (error) {
			downloadRpghqStatus.textContent = error.message;
			startDownloadRpghqButton.hidden = false;
			startDownloadRpghqButton.disabled = false;
		}
	});

	toggleRpghqListButton.addEventListener('click', () => {
		const isCollapsed = rpghqDownloadList.classList.contains('collapsed');
		if (isCollapsed) {
			rpghqDownloadList.classList.remove('collapsed');
			toggleRpghqListButton.textContent = '▼ Hide Downloads';
		} else {
			rpghqDownloadList.classList.add('collapsed');
			toggleRpghqListButton.textContent = '▶ Show Downloads';
		}
		saveRpghqListCollapsedState(!isCollapsed);
	});
});
