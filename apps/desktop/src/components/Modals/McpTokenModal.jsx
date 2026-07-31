import { useUIStore } from '@/store/uiStore';
import ModalShell from './ModalShell';
import McpTokenSection from '@/components/Profile/McpTokenSection';

export default function McpTokenModal() {
  const { setShowMcpTokenModal } = useUIStore();

  return (
    <ModalShell
      onClose={() => setShowMcpTokenModal(false)}
      title="MCP / API Tokens"
      subtitle="Connect Cursor or Claude to PayloadX"
      wide
      showLogo
    >
      <McpTokenSection />
    </ModalShell>
  );
}
