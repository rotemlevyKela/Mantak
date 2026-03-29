import { Navigate, Route, Routes } from 'react-router-dom'
import { InterestAreasPage } from '../features/admin/InterestAreasPage'
import { CalibrationPage } from '../features/admin/CalibrationPage'
import { PoleControlPage } from '../features/admin/PoleControlPage'
import { OperatorPage } from '../features/operator/OperatorPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/operator" replace />} />
      <Route path="/operator" element={<OperatorPage />} />
      <Route path="/admin/interest-areas" element={<InterestAreasPage />} />
      <Route path="/admin/calibration" element={<CalibrationPage />} />
      <Route path="/admin/pole-control" element={<PoleControlPage />} />
      <Route path="*" element={<Navigate to="/operator" replace />} />
    </Routes>
  )
}
