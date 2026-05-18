'use client'

import { useEffect } from 'react'

export default function SecurityProvider() {
  useEffect(() => {
    // 1. Disable right click (Context Menu)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
    }
    document.addEventListener('contextmenu', handleContextMenu)

    // 2. Disable inspection & developer keys
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable F12 key
      if (e.key === 'F12') {
        e.preventDefault()
        return false
      }

      // Disable Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (Inspect controls)
      if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) {
        e.preventDefault()
        return false
      }

      // Disable Ctrl+U (View Source code)
      if (e.ctrlKey && e.key.toUpperCase() === 'U') {
        e.preventDefault()
        return false
      }

      // Disable Ctrl+S (Save webpage file)
      if (e.ctrlKey && e.key.toUpperCase() === 'S') {
        e.preventDefault()
        return false
      }

      // Disable Ctrl+C / Ctrl+A / Ctrl+X (Copy / Select all / Cut)
      if (e.ctrlKey && ['C', 'A', 'X'].includes(e.key.toUpperCase())) {
        e.preventDefault()
        return false
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    // 3. Disable text copying event explicitly
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault()
    }
    document.addEventListener('copy', handleCopy)

    // 4. Disable content dragging/saving
    const handleDragStart = (e: DragEvent) => {
      e.preventDefault()
    }
    document.addEventListener('dragstart', handleDragStart)

    // 5. Anti-screenshot / Anti-recording (Obscure screen on blur)
    const handleBlur = () => {
      document.body.style.filter = 'blur(10px)'
      document.body.style.opacity = '0.01' // Nearly invisible to prevent capture
    }

    const handleFocus = () => {
      document.body.style.filter = 'none'
      document.body.style.opacity = '1'
    }

    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)

    // 6. Detect PrintScreen
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        navigator.clipboard.writeText('Conteúdo protegido. A captura de tela não é permitida.').catch(() => { })
      }
    }
    window.addEventListener('keyup', handleKeyUp)

    // Add Mac Screenshot shortcuts (Cmd+Shift+3/4/5) block in handleKeyDown
    const handleKeyDownCapture = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key)) {
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', handleKeyDownCapture)

    // 7. Prevent Print
    const style = document.createElement('style')
    style.innerHTML = `
      @media print {
        body { display: none !important; }
      }
      /* Prevent text selection globally just in case */
      *:not(input):not(textarea) {
        -webkit-user-select: none;
        -ms-user-select: none;
        user-select: none;
      }
    `
    document.head.appendChild(style)

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('copy', handleCopy)
      document.removeEventListener('dragstart', handleDragStart)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('keydown', handleKeyDownCapture)
      if (document.head.contains(style)) {
        document.head.removeChild(style)
      }
    }
  }, [])

  return null
}
