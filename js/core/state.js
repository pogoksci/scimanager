// ================================================================
// /js/core/state.js — 전역 상태 저장소 (App.State)
// ================================================================
(function () {
  const defaultState = {
    mode: "create",
    cabinetId: null,
    area_id: null,
    cabinet_name: null,
    door_vertical_count: null,
    door_horizontal_count: null,
    shelf_height: null,
    storage_columns: null,
    photo_url_320: null,
    photo_url_160: null,
    SelectedValues: {},
  };

  let currentState = { ...defaultState };

  function set(key, value) {
    currentState[key] = value;
  }
  function get(key) {
    return currentState[key];
  }
  function reset() {
    currentState = { ...defaultState };
  }
  function dump() {
    return { ...currentState };
  }

  globalThis.App = globalThis.App || {};
  globalThis.App.State = { set, get, reset, dump };
})();
