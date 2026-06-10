document.addEventListener('DOMContentLoaded', () => {
	const button = document.getElementById('find-bg3-folder');
	const status = document.getElementById('find-bg3-status');
	const manualForm = document.getElementById('manual-bg3-form');
	const manualInput = document.getElementById('manual-bg3-path');

	if (!button || !status || !manualForm || !manualInput) {
		return;
	}

	const checklistItem = document.getElementById('bg3-installation-item');
	const checkmark = checklistItem ? checklistItem.querySelector('.checkmark') : null;

	function markChecklistItemAsDone() {
		if (checkmark && checklistItem) {
			checkmark.textContent = '✓';
			checklistItem.classList.add('checklist-item--checked');
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
});
