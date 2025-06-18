export function useModelFromUrl() {
    const route = useRoute()
    const router = useRouter()
    
    const getModelFromUrl = (): string | null => {
        return route.query.model as string || null
    }
    
    const setModelInUrl = (modelId: string) => {
        const currentQuery = { ...route.query }
        currentQuery.model = modelId
        
        router.replace({
            query: currentQuery
        })
    }
    
    const removeModelFromUrl = () => {
        const currentQuery = { ...route.query }
        delete currentQuery.model
        
        router.replace({
            query: currentQuery
        })
    }
    
    return {
        getModelFromUrl,
        setModelInUrl,
        removeModelFromUrl
    }
}
