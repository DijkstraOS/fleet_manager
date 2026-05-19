export function RoutePanelView(props: {
  routeNodeIds: string[];
  onClearRoute: () => void;
}) {
  return (
    <section>
      <h2>Route</h2>
      <div className="route-list">
        {props.routeNodeIds.length === 0 ? <span className="muted">No route selected.</span> : props.routeNodeIds.join(" -> ")}
      </div>
      <button className="secondary-button" onClick={props.onClearRoute}>Clear route</button>
    </section>
  );
}
