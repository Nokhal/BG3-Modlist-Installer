document.addEventListener('DOMContentLoaded', () => {
	const button = document.getElementById('find-bg3-folder');
	const status = document.getElementById('find-bg3-status');
	const manualForm = document.getElementById('manual-bg3-form');
	const manualInput = document.getElementById('manual-bg3-path');
	const modsButton = document.getElementById('find-bg3-mods-folder');
	const modsStatus = document.getElementById('find-bg3-mods-status');
	const installBg3MmButton = document.getElementById('install-bg3mm-button');
	const installBg3MmStatus = document.getElementById('install-bg3mm-status');
	const installBg3MmItem = document.getElementById('install-bg3-mod-manager-item');
	const installBg3MmCheckmark = installBg3MmItem ? installBg3MmItem.querySelector('.checkmark') : null;
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
	const startDownloadNexusmodsButton = document.getElementById('start-download-nexusmods');
	const downloadNexusmodsStatus = document.getElementById('download-nexusmods-status');
	const downloadNexusmodsProgress = document.getElementById('download-nexusmods-progress');
	const nexusmodsDownloadList = document.getElementById('nexusmods-download-list');
	const toggleNexusmodsListButton = document.getElementById('toggle-nexusmods-list');
	const downloadNexusmodsItem = document.getElementById('download-nexusmods-item');
	const downloadNexusmodsCheckmark = downloadNexusmodsItem ? downloadNexusmodsItem.querySelector('.checkmark') : null;
	const nexusmodsApiKeyInput = document.getElementById('nexusmods-api-key');
	const startInstallFilesButton = document.getElementById('start-install-files');
	const installFilesStatus = document.getElementById('install-files-status');
	const installProgress = document.getElementById('install-progress');
	const installList = document.getElementById('install-list');
	const toggleInstallListButton = document.getElementById('toggle-install-list');
	const installFilesItem = document.getElementById('install-files-item');
	const installFilesCheckmark = installFilesItem ? installFilesItem.querySelector('.checkmark') : null;
	const restartButton = document.getElementById('restart-button');
	const clearDownloadsButton = document.getElementById('clear-downloads-button');
	const clearModsButton = document.getElementById('clear-mods-button');
	const checklistItems = Array.from(document.querySelectorAll('.checklist .checklist-item'));

	if (!button || !status || !manualForm || !manualInput || !modsButton || !modsStatus) {
		return;
	}

	const checklistItem = document.getElementById('bg3-installation-item');
	const checkmark = checklistItem ? checklistItem.querySelector('.checkmark') : null;
	const modsChecklistItem = document.getElementById('bg3-mods-folder-item');
	const modsCheckmark = modsChecklistItem ? modsChecklistItem.querySelector('.checkmark') : null;
	const AUTO_TRIGGER_DELAY_MS = 500;
	const BG3MM_PROJECT_URL = 'https://github.com/LaughingLeader/BG3ModManager';

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

	function wait(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
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

	function renderBg3MmDetectedStatus(exePath) {
		if (!installBg3MmStatus) {
			return;
		}

		installBg3MmStatus.textContent = '';
		installBg3MmStatus.appendChild(document.createTextNode(`BG3MM detected at: ${exePath}`));
		installBg3MmStatus.appendChild(document.createElement('br'));

		const downloadLink = document.createElement('a');
		downloadLink.href = BG3MM_PROJECT_URL;
		downloadLink.target = '_blank';
		downloadLink.rel = 'noopener noreferrer';
		downloadLink.textContent = 'Downloadable Here';
		downloadLink.className = 'mod-source-link';
		installBg3MmStatus.appendChild(downloadLink);
	}

	function applyBg3MmDetectionStatus(detectionResult) {
		if (!installBg3MmItem || !installBg3MmCheckmark || !installBg3MmStatus || !installBg3MmButton) {
			return;
		}

		if (detectionResult?.detected) {
			installBg3MmCheckmark.textContent = '✓';
			installBg3MmItem.classList.add('checklist-item--checked');
			installBg3MmButton.hidden = true;
			installBg3MmButton.disabled = true;
			renderBg3MmDetectedStatus(detectionResult.exePath);
		} else {
			installBg3MmCheckmark.textContent = '○';
			installBg3MmItem.classList.remove('checklist-item--checked');
			installBg3MmButton.hidden = false;
			installBg3MmButton.disabled = false;
			installBg3MmStatus.textContent = 'BGMM not detected. Install BG3 Mod Manager before continuing.';
		}

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
			const [bg3Response, modsResponse, bg3mmStatusResponse, modioDownloadResponse, rpghqDownloadResponse, modsExtractedResponse, nexusModApiKeyResponse, nexusmodsDownloadResponse] = await Promise.all([
				fetch('/api/settings/bg3InstallPath', { method: 'GET', cache: 'no-store' }),
				fetch('/api/settings/bg3ModsFolderPath', { method: 'GET', cache: 'no-store' }),
				fetch('/api/install-bg3-mod-manager/status', { method: 'GET', cache: 'no-store' }),
				fetch('/api/settings/modiodownload', { method: 'GET', cache: 'no-store' }),
				fetch('/api/settings/rpghqdownload', { method: 'GET', cache: 'no-store' }),
				fetch('/api/settings/modsextracted', { method: 'GET', cache: 'no-store' }),
				fetch('/api/settings/nexusModApiKey', { method: 'GET', cache: 'no-store' }),
				fetch('/api/settings/nexusmodsdownload', { method: 'GET', cache: 'no-store' }),
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

			if (bg3mmStatusResponse.ok) {
				const bg3mmPayload = await bg3mmStatusResponse.json();
				if (bg3mmPayload.success) {
					applyBg3MmDetectionStatus(bg3mmPayload.result);
				}
			}

			if (modioDownloadResponse.ok) {
				const modioPayload = await modioDownloadResponse.json();
				if (modioPayload.success && modioPayload.value === true) {
					// Run the same workflow as a manual click to keep behavior consistent.
					await wait(AUTO_TRIGGER_DELAY_MS);
					startDownloadButton.click();
				}
			}

			if (rpghqDownloadResponse.ok) {
				const rpghqPayload = await rpghqDownloadResponse.json();
				if (rpghqPayload.success && rpghqPayload.value === true) {
					// Run the same workflow as a manual click to keep behavior consistent.
					await wait(AUTO_TRIGGER_DELAY_MS);
					startDownloadRpghqButton.click();
				}
			}

			if (nexusModApiKeyResponse.ok) {
				const nexusPayload = await nexusModApiKeyResponse.json();
				if (nexusPayload.success && nexusPayload.value) {
					nexusmodsApiKeyInput.value = nexusPayload.value;
				}
			}

			if (nexusmodsDownloadResponse.ok) {
				const nexusmodsPayload = await nexusmodsDownloadResponse.json();
				if (nexusmodsPayload.success && nexusmodsPayload.value === true) {
					// Run the same workflow as a manual click to keep behavior consistent.
					await wait(AUTO_TRIGGER_DELAY_MS);
					startDownloadNexusmodsButton.click();
				}
			}

			if (modsExtractedResponse.ok) {
				const extractedPayload = await modsExtractedResponse.json();
				if (extractedPayload.success && extractedPayload.value === true) {
					// Run the same workflow as a manual click to keep behavior consistent.
					await wait(AUTO_TRIGGER_DELAY_MS);
					startExtractButton.click();
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

	function isValidHttpUrl(url) {
		if (typeof url !== 'string' || !url.trim()) {
			return false;
		}

		try {
			const parsed = new URL(url.trim());
			return parsed.protocol === 'http:' || parsed.protocol === 'https:';
		} catch {
			return false;
		}
	}

	function setFeedbackLineWithSourceLink(listItem, message, modPage) {
		listItem.textContent = message;

		if (!isValidHttpUrl(modPage)) {
			return;
		}

		listItem.appendChild(document.createTextNode(' | '));
		const sourceLink = document.createElement('a');
		sourceLink.href = modPage;
		sourceLink.target = '_blank';
		sourceLink.rel = 'noopener noreferrer';
		sourceLink.textContent = 'Source';
		sourceLink.className = 'mod-source-link';
		listItem.appendChild(sourceLink);
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
				setFeedbackLineWithSourceLink(listItem, `${modName} - ⬇ Already downloaded (${filename})`, mod.ModPage);
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
				setFeedbackLineWithSourceLink(listItem, `${modName} - ⬇ Already downloaded (${filename})`, mod.ModPage);
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

	if (installBg3MmButton && installBg3MmStatus) {
		installBg3MmButton.addEventListener('click', async () => {
			installBg3MmButton.disabled = true;
			installBg3MmStatus.textContent = 'Downloading and extracting latest BG3 Mod Manager...';

			try {
				const response = await fetch('/api/install-bg3-mod-manager', {
					method: 'POST',
				});
				const payload = await response.json();

				if (!response.ok || !payload.success) {
					throw new Error(payload.message || 'Failed to install BG3 Mod Manager.');
				}

				const alreadyDownloaded = payload.result?.alreadyDownloaded;
				const fileName = payload.result?.fileName || 'archive';
				const extractedTo = payload.result?.extractedTo || 'tools/bgmm';
				const statusPrefix = alreadyDownloaded ? '⬇ Already downloaded' : '✓ Downloaded';
				installBg3MmStatus.textContent = `${statusPrefix} ${fileName}; extracted to ${extractedTo}.`;

				const statusResponse = await fetch('/api/install-bg3-mod-manager/status', { method: 'GET', cache: 'no-store' });
				if (statusResponse.ok) {
					const statusPayload = await statusResponse.json();
					if (statusPayload.success) {
						applyBg3MmDetectionStatus(statusPayload.result);
					}
				}
			} catch (error) {
				installBg3MmStatus.textContent = `✗ Failed: ${error.message}`;
			} finally {
				if (!installBg3MmButton.hidden) {
					installBg3MmButton.disabled = false;
				}
			}
		});
	}

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
					setFeedbackLineWithSourceLink(
						listItem,
						`${modName} - ${statusText} (${downloadPayload.result.fileName})`,
						downloadPayload.result?.modPage || mod.ModPage,
					);
					listItem.style.color = 'green';
					successCount += 1;
				} catch (error) {
					setFeedbackLineWithSourceLink(listItem, `${modName} - ✗ Failed: ${error.message}`, mod.ModPage);
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
					const pakFileName = extractPayload.result?.pakfile;
					if (isAlreadyExtracted && pakFileName) {
						listItem.textContent = `${modName} - ${statusText} (${filename}) [${pakFileName}]`;
					} else {
						listItem.textContent = `${modName} - ${statusText} (${filename})`;
					}
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
					setFeedbackLineWithSourceLink(
						listItem,
						`${modName} - ${statusText} (${downloadPayload.result.fileName})`,
						downloadPayload.result?.modPage || mod.ModPage,
					);
					listItem.style.color = 'green';
					successCount += 1;
				} catch (error) {
					setFeedbackLineWithSourceLink(listItem, `${modName} - ✗ Failed: ${error.message}`, mod.ModPage);
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

	// Helper functions for nexusmods list collapse state
	function saveNexusmodsListCollapsedState(isCollapsed) {
		localStorage.setItem('nexusmodsListCollapsed', JSON.stringify(isCollapsed));
	}

	function loadNexusmodsListCollapsedState() {
		const saved = localStorage.getItem('nexusmodsListCollapsed');
		return saved !== null ? JSON.parse(saved) : false;
	}

	function applyNexusmodsListCollapsedState() {
		const isCollapsed = loadNexusmodsListCollapsedState();
		if (isCollapsed) {
			nexusmodsDownloadList.classList.add('collapsed');
			toggleNexusmodsListButton.textContent = '▶ Show Downloads';
		} else {
			nexusmodsDownloadList.classList.remove('collapsed');
			toggleNexusmodsListButton.textContent = '▼ Hide Downloads';
		}
	}

	startDownloadNexusmodsButton.addEventListener('click', async () => {
		// Save API key to settings first
		const apiKey = nexusmodsApiKeyInput.value.trim();
		if (!apiKey) {
			downloadNexusmodsStatus.textContent = 'Please enter your Nexus Mods API key.';
			return;
		}

		try {
			const apiKeyResponse = await fetch('/api/settings/nexusModApiKey', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ value: apiKey }),
			});

			if (!apiKeyResponse.ok) {
				throw new Error('Failed to save API key.');
			}
		} catch (error) {
			downloadNexusmodsStatus.textContent = `Error saving API key: ${error.message}`;
			return;
		}

		// Proceed with download
		startDownloadNexusmodsButton.disabled = true;
		startDownloadNexusmodsButton.hidden = true;
		downloadNexusmodsStatus.textContent = 'Loading mod list...';
		downloadNexusmodsProgress.hidden = false;
		nexusmodsDownloadList.innerHTML = '';
		toggleNexusmodsListButton.hidden = true;

		try {
			const modListResponse = await fetch('/api/modiolist', { method: 'GET', cache: 'no-store' });
			const modListPayload = await modListResponse.json();

			if (!modListResponse.ok || !modListPayload.success) {
				throw new Error(modListPayload.message || 'Failed to load mod list.');
			}

			const modList = modListPayload.modioList.ModList;

			// Filter to only nexusmods.com mods
			const nexusmodsMods = modList.filter(mod => mod.source === 'nexusmods.com');

			if (!Array.isArray(nexusmodsMods) || nexusmodsMods.length === 0) {
				downloadNexusmodsStatus.textContent = 'No nexusmods.com mods to download.';
				return;
			}

			downloadNexusmodsStatus.textContent = `Starting download of ${nexusmodsMods.length} mods...`;

			let successCount = 0;
			let failureCount = 0;

			for (const mod of nexusmodsMods) {
				const modName = mod.ModName || 'Unknown Mod';
				const listItem = document.createElement('li');
				listItem.textContent = `${modName} - Downloading...`;
				listItem.id = `nexusmods-item-${modName.replace(/[^a-z0-9]/gi, '_')}`;
				nexusmodsDownloadList.appendChild(listItem);

				try {
					const downloadResponse = await fetch('/api/download-mod', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							modName: mod.ModName,
							apiKey: apiKey,
						}),
					});

					const downloadPayload = await downloadResponse.json();

					if (!downloadResponse.ok || !downloadPayload.success) {
						throw new Error(downloadPayload.message || 'Download failed.');
					}

					const isAlreadyDownloaded = downloadPayload.result?.alreadyDownloaded;
					const statusText = isAlreadyDownloaded ? '⬇ Already downloaded' : '✓ Downloaded';
					setFeedbackLineWithSourceLink(
						listItem,
						`${modName} - ${statusText} (${downloadPayload.result.fileName})`,
						downloadPayload.result?.modPage || mod.ModPage,
					);
					listItem.style.color = 'green';
					successCount += 1;
				} catch (error) {
					setFeedbackLineWithSourceLink(listItem, `${modName} - ✗ Failed: ${error.message}`, mod.ModPage);
					listItem.style.color = 'red';
					failureCount += 1;
				}
			}

			downloadNexusmodsStatus.textContent = `Download complete. Success: ${successCount}, Failed: ${failureCount}.`;

			// Mark the download task as checked
			if (downloadNexusmodsCheckmark && downloadNexusmodsItem) {
				downloadNexusmodsCheckmark.textContent = '✓';
				downloadNexusmodsItem.classList.add('checklist-item--checked');
			}

			// Update settings to mark nexusmodsdownload as complete
			try {
				const settingsResponse = await fetch('/api/settings/nexusmodsdownload', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ value: true }),
				});

				if (!settingsResponse.ok) {
					console.error('Failed to update nexusmodsdownload setting');
				}
			} catch (error) {
				console.error('Error updating nexusmodsdownload setting:', error);
			}

			// Refresh checklist to show next step
			refreshChecklistProgress();

			// Show the toggle button
			toggleNexusmodsListButton.hidden = false;
			applyNexusmodsListCollapsedState();
		} catch (error) {
			downloadNexusmodsStatus.textContent = error.message;
			startDownloadNexusmodsButton.hidden = false;
			startDownloadNexusmodsButton.disabled = false;
		}
	});

	toggleNexusmodsListButton.addEventListener('click', () => {
		const isCollapsed = nexusmodsDownloadList.classList.contains('collapsed');
		if (isCollapsed) {
			nexusmodsDownloadList.classList.remove('collapsed');
			toggleNexusmodsListButton.textContent = '▼ Hide Downloads';
		} else {
			nexusmodsDownloadList.classList.add('collapsed');
			toggleNexusmodsListButton.textContent = '▶ Show Downloads';
		}
		saveNexusmodsListCollapsedState(!isCollapsed);
	});

	// Helper functions for install list collapse state
	function saveInstallListCollapsedState(isCollapsed) {
		localStorage.setItem('installListCollapsed', JSON.stringify(isCollapsed));
	}

	function loadInstallListCollapsedState() {
		const saved = localStorage.getItem('installListCollapsed');
		return saved !== null ? JSON.parse(saved) : false;
	}

	function applyInstallListCollapsedState() {
		const isCollapsed = loadInstallListCollapsedState();
		if (isCollapsed) {
			installList.classList.add('collapsed');
			toggleInstallListButton.textContent = '▶ Show Installations';
		} else {
			installList.classList.remove('collapsed');
			toggleInstallListButton.textContent = '▼ Hide Installations';
		}
	}

	startInstallFilesButton.addEventListener('click', async () => {
		startInstallFilesButton.disabled = true;
		startInstallFilesButton.hidden = true;
		installFilesStatus.textContent = 'Loading extracted mods list...';
		installProgress.hidden = false;
		installList.innerHTML = '';
		toggleInstallListButton.hidden = true;

		try {
			const modListResponse = await fetch('/api/modiolist', { method: 'GET', cache: 'no-store' });
			const modListPayload = await modListResponse.json();

			if (!modListResponse.ok || !modListPayload.success) {
				throw new Error(modListPayload.message || 'Failed to load mod list.');
			}

			const modList = modListPayload.modioList.ModList;

			// Filter to only mods with pak files
			const modsToInstall = modList.filter((mod) => mod.pakfile);

			if (modsToInstall.length === 0) {
				installFilesStatus.textContent = 'No mod files to install.';
				return;
			}

			installFilesStatus.textContent = `Starting installation of ${modsToInstall.length} mod files...`;

			let successCount = 0;
			let failureCount = 0;

			for (const mod of modsToInstall) {
				const modName = mod.ModName || 'Unknown Mod';
				const pakfile = mod.pakfile || 'Unknown';
				const listItem = document.createElement('li');
				listItem.textContent = `${modName} - Installing...`;
				listItem.id = `install-item-${modName.replace(/[^a-z0-9]/gi, '_')}`;
				installList.appendChild(listItem);

				try {
					const installResponse = await fetch('/api/copy-mod-pak', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							filename: pakfile,
						}),
					});

					const installPayload = await installResponse.json();

					if (!installResponse.ok || !installPayload.success) {
						throw new Error(installPayload.message || 'Installation failed.');
					}

					const isAlreadyQueued = installPayload.alreadyQueued;
					const statusText = isAlreadyQueued ? '⏳ Already queued' : '✓ Copied and ready to load';
					listItem.textContent = `${modName} - ${statusText} (${pakfile})`;
					listItem.style.color = 'green';
					successCount += 1;
				} catch (error) {
					listItem.textContent = `${modName} - ✗ Failed: ${error.message}`;
					listItem.style.color = 'red';
					failureCount += 1;
				}
			}

			installFilesStatus.textContent = `Installation queue complete. Queued: ${successCount}, Failed: ${failureCount}.`;

			// Now copy gameroot content as a final substep
			installFilesStatus.textContent += ' | Copying gameroot files...';

			try {
				const gamerootResponse = await fetch('/api/copy-gameroot-to-install', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
				});

				const gamerootPayload = await gamerootResponse.json();

				if (!gamerootResponse.ok || !gamerootPayload.success) {
					throw new Error(gamerootPayload.message || 'Failed to copy gameroot files.');
				}

				const gamerootListItem = document.createElement('li');
				const copiedCount = gamerootPayload.copiedCount || 0;
				gamerootListItem.textContent = `✓ Gameroot files - Copied ${copiedCount} files to BG3 install folder`;
				gamerootListItem.id = 'gameroot-item';
				gamerootListItem.style.color = 'green';
				installList.appendChild(gamerootListItem);

				installFilesStatus.textContent = `Installation complete. Queued: ${successCount}, Failed: ${failureCount}. Gameroot files copied: ${copiedCount}.`;
			} catch (error) {
				const gamerootListItem = document.createElement('li');
				gamerootListItem.textContent = `✗ Gameroot files - Failed: ${error.message}`;
				gamerootListItem.id = 'gameroot-item';
				gamerootListItem.style.color = 'red';
				installList.appendChild(gamerootListItem);

				installFilesStatus.textContent = `Installation complete. Queued: ${successCount}, Failed: ${failureCount}. Gameroot copy failed: ${error.message}`;
			}

			// Mark the install task as checked
			if (installFilesCheckmark && installFilesItem) {
				installFilesCheckmark.textContent = '✓';
				installFilesItem.classList.add('checklist-item--checked');
			}

			// Refresh checklist to show next step
			refreshChecklistProgress();

			// Show the toggle button
			toggleInstallListButton.hidden = false;
			applyInstallListCollapsedState();
		} catch (error) {
			installFilesStatus.textContent = error.message;
			startInstallFilesButton.hidden = false;
			startInstallFilesButton.disabled = false;
		}
	});

	toggleInstallListButton.addEventListener('click', () => {
		const isCollapsed = installList.classList.contains('collapsed');
		if (isCollapsed) {
			installList.classList.remove('collapsed');
			toggleInstallListButton.textContent = '▼ Hide Installations';
		} else {
			installList.classList.add('collapsed');
			toggleInstallListButton.textContent = '▶ Show Installations';
		}
		saveInstallListCollapsedState(!isCollapsed);
	});

	if (restartButton) {
		restartButton.addEventListener('click', async () => {
			const confirmRestart = confirm('Are you sure you want to restart the setup? All progress will be reset (except your Nexus Mods API key).');
			if (!confirmRestart) {
				return;
			}

			try {
				const response = await fetch('/api/settings/reset', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
				});

				const payload = await response.json();

				if (!response.ok || !payload.success) {
					throw new Error(payload.message || 'Failed to reset settings.');
				}

				// Reload the page to reflect the reset
				window.location.reload();
			} catch (error) {
				alert(`Error resetting setup: ${error.message}`);
			}
		});
	}

	if (clearDownloadsButton) {
		clearDownloadsButton.addEventListener('click', async () => {
			const confirmClear = confirm('Are you sure you want to delete all files in the Downloads folder? This cannot be undone.');
			if (!confirmClear) {
				return;
			}

			try {
				const response = await fetch('/api/clear-downloads', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
				});

				const payload = await response.json();

				if (!response.ok || !payload.success) {
					throw new Error(payload.message || 'Failed to clear Downloads folder.');
				}

				alert(`Downloads folder cleared successfully. ${payload.deleted} files deleted.`);
			} catch (error) {
				alert(`Error clearing Downloads folder: ${error.message}`);
			}
		});
	}

	if (clearModsButton) {
		clearModsButton.addEventListener('click', async () => {
			const confirmClear = confirm('Are you sure you want to delete all files in the Mods folder? This cannot be undone.');
			if (!confirmClear) {
				return;
			}

			try {
				const response = await fetch('/api/clear-mods', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
				});

				const payload = await response.json();

				if (!response.ok || !payload.success) {
					throw new Error(payload.message || 'Failed to clear Mods folder.');
				}

				alert(`Mods folder cleared successfully. ${payload.deleted} files deleted.`);
			} catch (error) {
				alert(`Error clearing Mods folder: ${error.message}`);
			}
		});
	}
});
