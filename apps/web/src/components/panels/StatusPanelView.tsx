export function StatusPanelView(props: {
  primaryStatus: string;
  realtimeStatus: string;
}) {
  return (
    <section>
      <h2>Status</h2>
      <p className="status-text">{props.primaryStatus}</p>
      <p className="status-subtext">{props.realtimeStatus}</p>
    </section>
  );
}
