use crate::ts_bridge::{TsBridgeRuntime, types::bridge::BridgeRuntimeEvent};

impl TsBridgeRuntime {
    pub(crate) fn apply_bridge_events(&mut self, events: Vec<BridgeRuntimeEvent>) {
        self.sync.apply_bridge_events(events);
    }
}
