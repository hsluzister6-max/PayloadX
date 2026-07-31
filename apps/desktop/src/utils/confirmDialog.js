import { useUIStore } from '@/store/uiStore';

/**
 * Show the in-app ConfirmDialog and resolve with true/false.
 * Prefer this over window.confirm / window.alert / Tauri dialogs.
 *
 * @param {object|string} options - message string, or config object
 * @param {string} [options.title='Confirm']
 * @param {string} [options.message]
 * @param {string} [options.itemName]
 * @param {string} [options.confirmText]
 * @param {string} [options.cancelText='Cancel']
 * @param {boolean} [options.danger=true]
 * @returns {Promise<boolean>}
 */
export function confirmDialog(options = {}) {
  const config = typeof options === 'string' ? { message: options } : options;
  const {
    title = 'Confirm',
    message = 'Are you sure?',
    itemName,
    confirmText,
    cancelText = 'Cancel',
    danger = true,
  } = config;

  return new Promise((resolve) => {
    useUIStore.getState().setShowConfirmDialog(true, {
      title,
      message,
      itemName,
      confirmText: confirmText ?? (danger ? 'Delete' : 'Ok'),
      cancelText,
      danger,
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}
