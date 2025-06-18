import { useSidebar as uiUseSidebar } from '@/components/ui/sidebar'

//Awful hack but no time to fix it properly
export function useSidebar() {
    let sidebar = null

    try {
        sidebar = uiUseSidebar()
    } catch (error) {
        //No error handling
    }

    return sidebar
}