document.addEventListener('DOMContentLoaded', () => {
	const button = document.getElementById('find-bg3-folder');
	const status = document.getElementById('find-bg3-status');

	if (!button || !status) {
		return;
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
				throw new Error(payload.message || 'The server could not find the game folder.');
			}

			status.textContent = `${payload.message} ${payload.installPath}`;
		} catch (error) {
			status.textContent = error.message;
		} finally {
			button.disabled = false;
		}
	});
});
