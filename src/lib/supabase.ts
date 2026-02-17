import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export const signInSupabaseWithFirebase = async (firebaseEmail: string) => {
  try {
    // Check if user exists in Supabase
    const { data: { user } } = await supabase.auth.getUser()

    if (user?.email === firebaseEmail) {
      // Already signed in
      return user
    }

    // Sign in with magic link (no password needed)
    const { error } = await supabase.auth.signInWithOtp({
      email: firebaseEmail,
      options: {
        shouldCreateUser: true,
      }
    })

    if (error) throw error
    return null
  } catch (error) {
    console.error('Error signing in to Supabase:', error)
    throw error
  }
}

export const uploadToSupabase = async (
  file: File,
  fileType: string,
  userEmail: string
) => {
  try {
    // Ensure user is authenticated in Supabase
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      throw new Error('Usuario no autenticado en Supabase')
    }

    // Upload file to Supabase Storage
    const fileName = `${fileType}_${Date.now()}_${file.name}`
    const { data, error: uploadError } = await supabase.storage
      .from('bukzbrain-files')
      .upload(`operations/${fileName}`, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) throw uploadError

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('bukzbrain-files').getPublicUrl(`operations/${fileName}`)

    return {
      name: file.name,
      url: publicUrl,
      uploadedAt: new Date().toISOString(),
      uploadedBy: userEmail,
      size: file.size,
      type: fileType,
    }
  } catch (error) {
    console.error('Error uploading to Supabase:', error)
    throw error
  }
}
