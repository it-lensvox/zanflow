import React from 'react';
import { AlertTriangle, FileText } from 'lucide-react';

export type DeleteModalType = 'confirm' | 'denied';

export interface DeleteModalProps {
  isOpen: boolean;
  type: DeleteModalType;
  itemType: 'thread' | 'task' | 'project' | 'document' | string;
  itemName?: string;
  onConfirm?: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

const DeleteModal: React.FC<DeleteModalProps> = ({
  isOpen,
  type,
  itemType,
  itemName,
  onConfirm,
  onCancel,
  isDeleting = false,
}) => {
  if (!isOpen) return null;

  // Permission Denied Modal
  if (type === 'denied') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center animate-in fade-in duration-200">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onCancel}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 animate-in zoom-in-95 duration-200">
          {/* Warning Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-yellow-100 flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-yellow-600" />
            </div>
          </div>

          {/* Title */}
          <h3 className="text-2xl font-bold text-gray-900 text-center mb-4">
            Permission Denied
          </h3>

          {/* Message */}
          <p className="text-gray-600 text-center mb-2">
            You can't delete this {itemType}.
          </p>
          <p className="text-gray-600 text-center mb-8">
            Only the <span className="font-semibold text-gray-900">person who created it</span> can delete it.
          </p>

          {/* Button */}
          <button
            onClick={onCancel}
            className="w-full px-6 py-3 text-white bg-gray-800 rounded-lg hover:bg-gray-900 transition-colors font-medium text-base focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            OK, Got it
          </button>
        </div>
      </div>
    );
  }

  // Delete Confirmation Modal
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={isDeleting ? undefined : onCancel}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 animate-in zoom-in-95 duration-200">
        {/* Delete Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <FileText className="w-8 h-8 text-red-600" />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-2xl font-bold text-gray-900 text-center mb-4">
          Confirm Deletion
        </h3>

        {/* Message */}
        <p className="text-gray-600 text-center mb-8">
          {itemName ? (
            <>
              Are you sure you want to delete{' '}
              <span className="font-semibold text-gray-900">"{itemName}"</span>?
            </>
          ) : (
            `Are you sure you want to delete this ${itemType}?`
          )}
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
          >
            No
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-6 py-3 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            {isDeleting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Deleting...
              </span>
            ) : (
              'Yes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteModal;