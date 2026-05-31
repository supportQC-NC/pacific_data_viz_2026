// src/store/slices/climateSlice.js
// ============================================================
// État Redux des données climatiques (appels API PDH).
// Thunk générique : loadDataset('seaLevel'), etc.
// ============================================================

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchDataset, DATASETS } from '../../services/pdhApi';

export const loadDataset = createAsyncThunk(
  'climate/loadDataset',
  async (id, { signal, rejectWithValue }) => {
    try {
      return await fetchDataset(id, { signal });
    } catch (err) {
      return rejectWithValue(err.message || 'fetch error');
    }
  },
  {
    condition: (id, { getState }) => {
      const e = getState().climate.datasets[id];
      if (e && (e.status === 'loading' || e.status === 'succeeded')) return false;
      return true;
    },
  }
);

const initialDatasets = Object.keys(DATASETS).reduce((acc, id) => {
  acc[id] = { status: 'idle', data: null, error: null };
  return acc;
}, {});

const climateSlice = createSlice({
  name: 'climate',
  initialState: { datasets: initialDatasets },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadDataset.pending, (state, action) => {
        state.datasets[action.meta.arg] = { status: 'loading', data: null, error: null };
      })
      .addCase(loadDataset.fulfilled, (state, action) => {
        state.datasets[action.meta.arg] = { status: 'succeeded', data: action.payload, error: null };
      })
      .addCase(loadDataset.rejected, (state, action) => {
        state.datasets[action.meta.arg] = { status: 'failed', data: null, error: action.payload || 'error' };
      });
  },
});

export const selectDataset = (id) => (state) => state.climate.datasets[id];
export default climateSlice.reducer;