const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class CopyModsQueue extends EventEmitter {
	constructor() {
		super();
		this.queue = [];
		this.queuedFiles = new Set();
		this.isProcessing = false;
	}

	/**
	 * Add a PAK file to the copy queue
	 * @param {string} filename - The filename of the PAK file to copy
	 * @param {string} modsSourcePath - The source Mods folder path
	 * @param {string} modsDestinationPath - The destination BG3 Mods folder path
	 * @returns {object} Status object indicating if file was queued
	 */
	addToQueue(filename, modsSourcePath, modsDestinationPath) {
		// Validate filename ends with .pak
		if (!filename.toLowerCase().endsWith('.pak')) {
			return {
				success: false,
				message: 'File must be a .pak file',
			};
		}

		// Check if this exact file is already queued
		if (this.queuedFiles.has(filename)) {
			return {
				success: true,
				alreadyQueued: true,
				message: `File "${filename}" is already in the copy queue`,
				queuePosition: this.queue.length,
			};
		}

		// Validate source file exists
		const sourceFilePath = path.join(modsSourcePath, filename);
		if (!fs.existsSync(sourceFilePath)) {
			return {
				success: false,
				message: `Source file not found: ${filename}`,
			};
		}

		// Add to queue
		this.queue.push({
			filename,
			sourceFilePath,
			destinationFilePath: path.join(modsDestinationPath, filename),
		});
		this.queuedFiles.add(filename);

		// Start processing if not already processing
		this.processQueue();

		return {
			success: true,
			message: `File "${filename}" added to copy queue`,
			queuePosition: this.queue.length,
		};
	}

	/**
	 * Process the copy queue one file at a time
	 */
	processQueue() {
		if (this.isProcessing || this.queue.length === 0) {
			return;
		}

		this.isProcessing = true;
		this.copyNextFile();
	}

	/**
	 * Copy the next file in the queue
	 */
	copyNextFile() {
		if (this.queue.length === 0) {
			this.isProcessing = false;
			this.emit('queueComplete');
			return;
		}

		const job = this.queue.shift();

		fs.copyFile(job.sourceFilePath, job.destinationFilePath, (err) => {
			this.queuedFiles.delete(job.filename);

			if (err) {
				console.error(`[CopyMods] Error copying ${job.filename}:`, err.message);
				this.emit('error', {
					filename: job.filename,
					error: err.message,
				});
			} else {
				console.log(`[CopyMods] Successfully copied: ${job.filename}`);
				this.emit('completed', {
					filename: job.filename,
					destination: job.destinationFilePath,
				});
			}

			// Process next file
			this.copyNextFile();
		});
	}

	/**
	 * Get the current queue status
	 */
	getStatus() {
		return {
			isProcessing: this.isProcessing,
			queueLength: this.queue.length,
			queuedFiles: Array.from(this.queuedFiles),
		};
	}
}

module.exports = new CopyModsQueue();
