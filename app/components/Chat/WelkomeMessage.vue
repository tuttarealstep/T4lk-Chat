<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { useUserStore } from '~/stores/user'
import type { UseChatHelpers } from '@ai-sdk/vue'

const { t, tm } = useI18n()
const userStore = useUserStore()

// Inject chat state from parent component
const chatState = inject('chatState') as UseChatHelpers | undefined

if (!chatState) {
    throw new Error('WelcomeMessage must be used within a Chat component')
}

const { input } = chatState

// Get user's name for personalized greeting
const userName = computed(() => userStore.preferences.name)

// Helper function to get string from translation array
const getTranslationArray = (key: string): string[] => {
    const translationArray = tm(key)
    if (Array.isArray(translationArray)) {
        return translationArray.map(item => {
            if (typeof item === 'string') {
                return item
            } else if (item && typeof item === 'object' && 'body' in item && item.body && 'static' in item.body) {
                return item.body.static as string
            } else if (item && typeof item === 'object' && 'toString' in item) {
                return item.toString()
            }
            return String(item)
        })
    }
    return []
}

// Categories with their icons and questions
const categories = computed(() => [
    {
        id: 'create',
        icon: 'lucide:sparkles',
        label: t('welcome.categories.create'),
        questions: getTranslationArray('welcome.questions.create')
    },
    {
        id: 'explore',
        icon: 'lucide:newspaper',
        label: t('welcome.categories.explore'),
        questions: getTranslationArray('welcome.questions.explore')
    },
    {
        id: 'code',
        icon: 'lucide:code',
        label: t('welcome.categories.code'),
        questions: getTranslationArray('welcome.questions.code')
    },
    {
        id: 'learn',
        icon: 'lucide:graduation-cap',
        label: t('welcome.categories.learn'),
        questions: getTranslationArray('welcome.questions.learn')
    }
])

// Selected category for showing questions - preselect first category
const selectedCategory = ref<string | null>('create')

// Handle category button click
const handleCategoryClick = (categoryId: string) => {
    selectedCategory.value = selectedCategory.value === categoryId ? null : categoryId
}

// Handle question click - insert into chat input
const handleQuestionClick = (question: string | any) => {
    // Convert question to string if it's an object
    let questionText = question
    if (typeof question === 'object' && question !== null) {
        if ('body' in question && question.body && 'static' in question.body) {
            questionText = question.body.static
        } else {
            questionText = String(question)
        }
    }

    input.value = questionText
    // Focus the input if it exists
    nextTick(() => {
        const chatInput = document.getElementById('chat-input')
        if (chatInput) {
            chatInput.focus()
        }
    })
}

// Get questions for selected category
const selectedQuestions = computed(() => {
    if (!selectedCategory.value) return []
    const category = categories.value.find(cat => cat.id === selectedCategory.value)
    return category ? category.questions : []
})

// Personalized greeting
const greeting = computed(() => {
    return userName.value
        ? t('welcome.greeting', { name: userName.value })
        : t('welcome.greeting_default')
})
</script>

<template>
    <div class="flex h-full items-start justify-center">
        <div
            class="w-full space-y-6 px-2 pt-6 sm:pt-[calc(max(15vh,2.5rem))] duration-300 animate-in fade-in-50 zoom-in-95 sm:px-8">
            <ClientOnly>
                <h2 class="text-3xl font-semibold">{{ greeting }}</h2>
                <template #fallback>
                    <h2 class="text-3xl font-semibold">{{ $t('welcome.greeting_default') }}</h2>
                </template>
            </ClientOnly>

            <!-- Category buttons -->
            <div class="flex flex-row flex-wrap gap-2.5 text-sm max-sm:justify-evenly">
                <Button v-for="category in categories" :key="category.id" variant="secondary"
                    class="max-sm:size-16 max-sm:flex-col sm:gap-2 sm:rounded-full transition-colors" :class="{
                        'bg-primary text-primary-foreground hover:bg-primary/90': selectedCategory === category.id,
                        'hover:bg-secondary/80': selectedCategory !== category.id
                    }" @click="handleCategoryClick(category.id)">
                    <Icon :name="category.icon" class="max-sm:block" />
                    <div>{{ category.label }}</div>
                </Button>
            </div>

            <!-- Questions list -->
            <div class="flex flex-col text-foreground min-h-[240px] relative">
                <Transition enter-active-class="transition-all duration-300 ease-out"
                    enter-from-class="opacity-0 translate-y-6 scale-95"
                    enter-to-class="opacity-100 translate-y-0 scale-100"
                    leave-active-class="transition-all duration-200 ease-in"
                    leave-from-class="opacity-100 translate-y-0 scale-100"
                    leave-to-class="opacity-0 -translate-y-6 scale-95" mode="out-in">
                    <div v-if="selectedCategory" :key="selectedCategory" class="space-y-0">
                        <div v-for="(question, index) in selectedQuestions" :key="index"
                            class="flex items-start gap-2 border-t border-secondary/40 py-1 first:border-none transform transition-all duration-200"
                            :style="{ 'transition-delay': `${index * 50}ms` }">
                            <button
                                class="w-full rounded-md py-2 text-left text-secondary-foreground hover:bg-secondary/50 sm:px-3 transition-all duration-200 hover:translate-x-1"
                                @click="handleQuestionClick(question)">
                                <span>{{ question }}</span>
                            </button>
                        </div>
                    </div>
                </Transition>
            </div>
        </div>
    </div>
</template>