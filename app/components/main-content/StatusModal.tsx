import { Button } from "@/components/ui/button"

interface StatusModalProps {
  statusModal: {
    isOpen: boolean;
    type: 'guard' | 'strength' | 'mp';
    currentValue: number;
    maxValue: number;
    characterId: number;
    character: any;
  } | null;
  onClose: () => void;
  onUpdate: (value: number) => void;
  onValueChange: (value: number) => void;
}

export default function StatusModal({ 
  statusModal, 
  onClose, 
  onUpdate, 
  onValueChange 
}: StatusModalProps) {
  if (!statusModal) return null;

  const getStatusLabel = () => {
    switch (statusModal.type) {
      case 'guard': return 'Guard'
      case 'strength': return 'Strength'
      case 'mp': return 'MP'
      default: return 'Status'
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[100]" 
      onClick={onClose}
    >
      <div 
        className="bg-white p-6 rounded-lg shadow-lg z-[101]" 
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4">
          Update {getStatusLabel()}
        </h3>
        <div className="flex flex-col gap-4">
          <div className="flex items-center space-x-2">
            <input
              type="number" 
              min="0"
              value={statusModal.currentValue === 0 ? '' : statusModal.currentValue}
              onChange={(e) => {
                const value = e.target.value === '' ? '' : parseInt(e.target.value);
                onValueChange(value === '' ? 0 : value);
              }}
              className="w-24 px-2 py-1 border rounded" 
              autoFocus
            />
            <span>/ {statusModal.maxValue}</span>
          </div>
          <div className="flex justify-end">
            <Button 
              onClick={() => onUpdate(statusModal.currentValue)} 
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
} 