import { getAuth } from 'firebase/auth'

const CLOUD_FUNCTION_URL = 'https://us-central1-bukzbrain-v2-glow-bright.cloudfunctions.net/uploadFile'

export const uploadToSupabase = async (
  file: File,
  fileType: string,
  userEmail: string
) => {
  try {
    // Get Firebase auth token
    const auth = getAuth()
    const user = auth.currentUser

    if (!user) {
      throw new Error('Usuario no autenticado')
    }

    const token = await user.getIdToken()

    // Create FormData for multipart upload
    const formData = new FormData()
    formData.append('file', file)
    formData.append('fileType', fileType)

    // Call Cloud Function
    const response = await fetch(CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Error uploading file')
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'Upload failed')
    }

    return result.file
  } catch (error) {
    console.error('Error uploading to Supabase:', error)
    throw error
  }
}
