import { toast } from 'vue-sonner'
import { useI18n } from 'vue-i18n'

export interface FileHandlingOptions {
  supportedTypes?: string[]
  maxFileSize?: number
  maxFiles?: number
}

export interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  data?: string
}

export function useFileHandling(options: FileHandlingOptions = {}) {
  const { 
    supportedTypes = ['image/*', 'application/pdf'],
    maxFileSize = 10 * 1024 * 1024, // 10MB
    maxFiles = 5 
  } = options
  
  const { t } = useI18n()
  
  const isUploading = ref(false)
  const uploadedFiles = ref<UploadedFile[]>([])
  
  const fileInputRef = ref<HTMLInputElement | null>(null)

  // File type utilities
  const getFileTypeIcon = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return 'lucide:image'
    if (mimeType === 'application/pdf') return 'lucide:file-text'
    return 'lucide:file'
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Check file size
    if (file.size > maxFileSize) {
      return {
        valid: false,
        error: t('chat.file_too_large', { 
          size: formatFileSize(file.size), 
          maxSize: formatFileSize(maxFileSize) 
        })
      }
    }

    // Check file type
    const isSupported = supportedTypes.some(type => {
      if (type.endsWith('/*')) {
        const baseType = type.replace('/*', '')
        return file.type.startsWith(baseType)
      }
      return file.type === type
    })

    if (!isSupported) {
      return {
        valid: false,
        error: t('chat.unsupported_file_type', { type: file.type })
      }
    }

    return { valid: true }
  }

  const validateFiles = (files: File[]): { valid: boolean; error?: string } => {
    if (uploadedFiles.value.length + files.length > maxFiles) {
      return {
        valid: false,
        error: t('chat.too_many_files', { max: maxFiles })
      }
    }

    for (const file of files) {
      const validation = validateFile(file)
      if (!validation.valid) {
        return validation
      }
    }

    return { valid: true }
  }

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const uploadFiles = async (files: File[]): Promise<void> => {
    if (files.length === 0) return

    const validation = validateFiles(files)
    if (!validation.valid) {
      toast.error(validation.error!)
      return
    }

    isUploading.value = true

    try {
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)

        try {
          const response = await $fetch<{ 
            id: string; 
            fileName: string; 
            fileSize: number; 
            mimeType: string 
          }>('/api/attachments', {
            method: 'POST',
            body: formData
          })

          // Convert file to base64 for immediate display
          const base64Data = await convertFileToBase64(file)

          uploadedFiles.value.push({
            id: response.id,
            name: response.fileName,
            size: response.fileSize,
            type: response.mimeType,
            data: base64Data
          })

          toast.success(t('chat.file_uploaded', { name: file.name }))
        } catch (error) {
          console.error('Error uploading file:', error)
          toast.error(t('chat.upload_error', { name: file.name }))
        }
      }
    } finally {
      isUploading.value = false
      clearFileInput()
    }
  }

  const removeFile = async (index: number): Promise<void> => {
    const file = uploadedFiles.value[index]
    if (!file) return

    try {
      await $fetch(`/api/attachments/${file.id}`, {
        method: 'DELETE'
      })

      uploadedFiles.value.splice(index, 1)
      toast.success(t('chat.attachment_removed'))
    } catch (error) {
      console.error('Error removing attachment:', error)
      toast.error(t('chat.attachment_remove_error'))
    }
  }

  const clearFiles = (): void => {
    uploadedFiles.value = []
  }

  const clearFileInput = (): void => {
    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }
  }

  const triggerFileInput = (): void => {
    fileInputRef.value?.click()
  }

  const handleFileInputChange = async (event: Event): Promise<void> => {
    const files = (event.target as HTMLInputElement).files
    if (!files || !files.length) return
    await uploadFiles(Array.from(files))
  }

  const handleDrop = async (event: DragEvent): Promise<void> => {
    event.preventDefault()
    const files = event.dataTransfer?.files
    if (!files || !files.length) return
    await uploadFiles(Array.from(files))
  }

  const handleDragOver = (event: DragEvent): void => {
    event.preventDefault()
  }

  // Computed properties
  const hasFiles = computed(() => uploadedFiles.value.length > 0)
  const fileIds = computed(() => uploadedFiles.value.map(f => f.id))
  const acceptString = computed(() => supportedTypes.join(','))

  return {
    // State
    isUploading: readonly(isUploading),
    uploadedFiles: readonly(uploadedFiles),
    fileInputRef,
    
    // Computed
    hasFiles,
    fileIds,
    acceptString,
    
    // Methods
    uploadFiles,
    removeFile,
    clearFiles,
    triggerFileInput,
    handleFileInputChange,
    handleDrop,
    handleDragOver,
    
    // Utilities
    getFileTypeIcon,
    formatFileSize,
    validateFile,
    validateFiles,
  }
}