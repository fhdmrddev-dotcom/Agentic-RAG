export function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase()
  const cls = "h-5 w-5"

  switch (ext) {
    case "pdf":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 18V6C4 4.89543 4.89543 4 6 4H14L20 10V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18Z" fill="#E12106"/>
          <path d="M14 4L20 10H14V4Z" fill="#B31D08"/>
          <text x="6" y="16" fill="white" fontSize="5" fontWeight="bold" fontFamily="sans-serif">PDF</text>
        </svg>
      )
    case "doc":
    case "docx":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 18V6C4 4.89543 4.89543 4 6 4H14L20 10V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18Z" fill="#2B579A"/>
          <path d="M14 4L20 10H14V4Z" fill="#1E3E6E"/>
          <text x="7" y="16.5" fill="white" fontSize="8" fontWeight="bold" fontFamily="sans-serif">W</text>
        </svg>
      )
    case "pptx":
    case "ppt":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 18V6C4 4.89543 4.89543 4 6 4H14L20 10V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18Z" fill="#D24726"/>
          <path d="M14 4L20 10H14V4Z" fill="#A4371D"/>
          <text x="7" y="16.5" fill="white" fontSize="8" fontWeight="bold" fontFamily="sans-serif">P</text>
        </svg>
      )
    case "xlsx":
    case "xls":
    case "csv":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 18V6C4 4.89543 4.89543 4 6 4H14L20 10V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18Z" fill="#217346"/>
          <path d="M14 4L20 10H14V4Z" fill="#185333"/>
          <text x="7" y="16.5" fill="white" fontSize="8" fontWeight="bold" fontFamily="sans-serif">X</text>
        </svg>
      )
    case "txt":
    case "md":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 18V6C4 4.89543 4.89543 4 6 4H14L20 10V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18Z" fill="#7B7B7B"/>
          <path d="M14 4L20 10H14V4Z" fill="#5F5F5F"/>
          <rect x="7" y="11" width="10" height="1" fill="white" opacity="0.5"/>
          <rect x="7" y="13" width="10" height="1" fill="white" opacity="0.5"/>
          <rect x="7" y="15" width="6" height="1" fill="white" opacity="0.5"/>
        </svg>
      )
    default:
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 18V6C4 4.89543 4.89543 4 6 4H14L20 10V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18Z" fill="#9CA3AF"/>
          <path d="M14 4L20 10H14V4Z" fill="#6B7280"/>
        </svg>
      )
  }
}
