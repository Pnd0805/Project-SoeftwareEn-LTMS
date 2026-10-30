/** ผู้ใช้เปิดสิทธิ์ในตั้งค่าเว็บไซต์แล้วกลับมา — เริ่มกล้องต่อได้เองไม่ต้องกดซ้ำ */
export function watchCameraPermission(onGranted: () => void) {
  let status: PermissionStatus | undefined
  let stopped = false
  const change = () => { if (status?.state === 'granted') onGranted() }
  /* Firefox รุ่นเก่าไม่รู้จักชื่อ camera และโยน TypeError — ไม่มีก็แค่ต้องกด Retry เอง */
  void navigator.permissions?.query({ name: 'camera' as PermissionName }).then(result => {
    if (stopped) return
    status = result
    result.addEventListener('change', change)
  }).catch(() => {})
  return () => { stopped = true; status?.removeEventListener('change', change) }
}
