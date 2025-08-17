import { test, expect, Page, BrowserContext } from '@playwright/test';

// Helper function to login
async function login(page: Page, username: string = 'admin', password: string = 'admin') {
  await page.goto('/login');
  await page.fill('[data-testid="username-input"]', username);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard');
}

// Helper function to logout
async function logout(page: Page) {
  // Look for logout button/link - adjust selector based on your UI
  await page.click('[data-testid="logout-button"]');
  await page.waitForURL('/login');
}

// Helper function to create a test project
async function createTestProject(page: Page, projectName: string = 'Race Condition Test Project') {
  await page.click('[data-testid="create-project-button"]');
  await page.fill('[data-testid="project-name-input"]', projectName);
  await page.click('[data-testid="save-project-button"]');
  await page.waitForSelector(`text=${projectName}`);
  return projectName;
}

// Helper function to upload a test image
async function uploadTestImage(page: Page, projectName: string) {
  // Navigate to project
  await page.click(`text=${projectName}`);
  
  // Create a simple test image blob
  const testImageData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  
  // Use file input to upload
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: 'race-condition-test.png',
    mimeType: 'image/png',
    buffer: Buffer.from(testImageData, 'base64'),
  });
  
  // Wait for upload to complete
  await page.waitForSelector('[data-testid="image-thumbnail"]');
}

// Helper function to start annotation on an image
async function startAnnotation(page: Page) {
  await page.click('[data-testid="image-thumbnail"]');
  await page.waitForURL(/\/project\/.*\/annotate\/.*/);
  
  // Enable drawing mode
  await page.keyboard.press('w');
  await expect(page.locator('text=Drawing Mode')).toBeVisible();
  
  // Draw a simple annotation
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();
  
  const canvasBounds = await canvas.boundingBox();
  if (!canvasBounds) throw new Error('Canvas not found');
  
  // Draw annotation
  await page.mouse.move(canvasBounds.x + 50, canvasBounds.y + 50);
  await page.mouse.down();
  await page.mouse.move(canvasBounds.x + 150, canvasBounds.y + 150);
  await page.mouse.up();
  
  // Wait for annotation to be created and saved
  await page.waitForTimeout(1000);
  await expect(page.locator('text=Current Annotations (1)')).toBeVisible();
  
  // Wait for save to complete
  await expect(page.locator('text=Saving...')).not.toBeVisible({ timeout: 10000 });
}

test.describe('Collaboration Race Condition Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Start with a clean state
    await page.goto('/');
  });

  test('should not trigger race condition when admin logs out and annotator logs in', async ({ browser }) => {
    // Create two contexts to simulate different users
    const adminContext = await browser.newContext();
    const annotatorContext = await browser.newContext();
    
    const adminPage = await adminContext.newPage();
    const annotatorPage = await annotatorContext.newPage();
    
    try {
      // Step 1: Admin logs in and creates project with image
      console.log('🔧 Admin logging in...');
      await login(adminPage, 'admin', 'admin');
      
      const projectName = await createTestProject(adminPage, 'Race Condition Test');
      await uploadTestImage(adminPage, projectName);
      
      // Step 2: Admin starts annotating
      console.log('🎯 Admin starting annotation...');
      await startAnnotation(adminPage);
      
      // Verify admin is working on the image
      await expect(adminPage.locator('text=Current Annotations (1)')).toBeVisible();
      
      // Step 3: Admin logs out
      console.log('🚪 Admin logging out...');
      await logout(adminPage);
      
      // Wait a moment for cleanup to complete
      await adminPage.waitForTimeout(2000);
      
      // Step 4: Annotator logs in
      console.log('👤 Annotator logging in...');
      await login(annotatorPage, 'annotator', 'annotator');
      
      // Navigate to the same project
      await annotatorPage.click(`text=${projectName}`);
      
      // Step 5: Annotator tries to access the same image
      console.log('🔍 Annotator accessing same image...');
      await annotatorPage.click('[data-testid="image-thumbnail"]');
      await annotatorPage.waitForURL(/\/project\/.*\/annotate\/.*/);
      
      // Step 6: Verify no race condition warning appears
      console.log('✅ Checking for race condition warnings...');
      
      // Should NOT see conflict resolution dialog or race condition warnings
      await expect(annotatorPage.locator('text=race condition')).not.toBeVisible({ timeout: 3000 });
      await expect(annotatorPage.locator('text=already in use')).not.toBeVisible({ timeout: 3000 });
      await expect(annotatorPage.locator('text=take over')).not.toBeVisible({ timeout: 3000 });
      
      // Should be able to start annotation normally
      await annotatorPage.keyboard.press('w');
      await expect(annotatorPage.locator('text=Drawing Mode')).toBeVisible();
      
      // Should see the previous annotation from admin
      await expect(annotatorPage.locator('text=Current Annotations (1)')).toBeVisible();
      
      console.log('✅ Race condition test passed - no conflict detected');
      
    } finally {
      await adminContext.close();
      await annotatorContext.close();
    }
  });

  test('should handle concurrent user sessions correctly', async ({ browser }) => {
    // Create contexts for admin and annotator
    const adminContext = await browser.newContext();
    const annotatorContext = await browser.newContext();
    
    const adminPage = await adminContext.newPage();
    const annotatorPage = await annotatorContext.newPage();
    
    try {
      // Step 1: Setup project with admin
      console.log('🔧 Setting up project...');
      await login(adminPage, 'admin', 'admin');
      const projectName = await createTestProject(adminPage, 'Concurrent Test');
      await uploadTestImage(adminPage, projectName);
      
      // Step 2: Admin starts annotation
      console.log('🎯 Admin starting annotation...');
      await startAnnotation(adminPage);
      
      // Step 3: While admin is still active, annotator logs in
      console.log('👤 Annotator logging in while admin is active...');
      await login(annotatorPage, 'annotator', 'annotator');
      await annotatorPage.click(`text=${projectName}`);
      
      // Step 4: Annotator tries to access the same image
      await annotatorPage.click('[data-testid="image-thumbnail"]');
      await annotatorPage.waitForURL(/\/project\/.*\/annotate\/.*/);
      
      // Should show that image is currently in use by admin
      // Wait for collaboration system to detect the conflict
      await annotatorPage.waitForTimeout(3000);
      
      // Check if conflict resolution appears (this is expected behavior)
      const hasConflictDialog = await annotatorPage.locator('text=already in use').isVisible({ timeout: 5000 });
      if (hasConflictDialog) {
        console.log('✅ Conflict correctly detected - admin is still active');
      }
      
      // Step 5: Admin logs out
      console.log('🚪 Admin logging out...');
      await logout(adminPage);
      
      // Wait for cleanup
      await annotatorPage.waitForTimeout(15000); // Wait for cleanup intervals to run
      
      // Step 6: Annotator should now be able to access without conflict
      await annotatorPage.reload();
      await annotatorPage.waitForURL(/\/project\/.*\/annotate\/.*/);
      
      // Should not have conflict anymore
      await expect(annotatorPage.locator('text=already in use')).not.toBeVisible({ timeout: 5000 });
      
      // Should be able to annotate
      await annotatorPage.keyboard.press('w');
      await expect(annotatorPage.locator('text=Drawing Mode')).toBeVisible();
      
      console.log('✅ Concurrent session test passed');
      
    } finally {
      await adminContext.close();
      await annotatorContext.close();
    }
  });

  test('should clean up session data properly on browser tab close', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    try {
      // Step 1: User logs in on first tab
      console.log('🔧 User logging in on tab 1...');
      await login(page1, 'admin', 'admin');
      const projectName = await createTestProject(page1, 'Tab Close Test');
      await uploadTestImage(page1, projectName);
      await startAnnotation(page1);
      
      // Step 2: Same user logs in on second tab
      console.log('🔧 Same user logging in on tab 2...');
      await login(page2, 'admin', 'admin');
      await page2.click(`text=${projectName}`);
      
      // Step 3: Close first tab/context (simulates tab close)
      console.log('🚪 Closing tab 1...');
      await context1.close();
      
      // Wait for cleanup
      await page2.waitForTimeout(15000);
      
      // Step 4: Second tab should work normally
      await page2.click('[data-testid="image-thumbnail"]');
      await page2.waitForURL(/\/project\/.*\/annotate\/.*/);
      
      // Should not have any conflicts
      await expect(page2.locator('text=already in use')).not.toBeVisible({ timeout: 3000 });
      
      console.log('✅ Tab close cleanup test passed');
      
    } finally {
      await context2.close();
    }
  });

  test('should handle rapid user switching without conflicts', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      // Step 1: Setup project
      console.log('🔧 Setting up project...');
      await login(page, 'admin', 'admin');
      const projectName = await createTestProject(page, 'Rapid Switch Test');
      await uploadTestImage(page, projectName);
      
      // Step 2: Start annotation
      await startAnnotation(page);
      
      // Step 3: Rapid logout and login as different user
      console.log('🔄 Rapid user switching...');
      await logout(page);
      await login(page, 'annotator', 'annotator');
      
      // Step 4: Access same project immediately
      await page.click(`text=${projectName}`);
      await page.click('[data-testid="image-thumbnail"]');
      await page.waitForURL(/\/project\/.*\/annotate\/.*/);
      
      // Should not have conflicts
      await expect(page.locator('text=already in use')).not.toBeVisible({ timeout: 3000 });
      
      // Should be able to work normally
      await page.keyboard.press('w');
      await expect(page.locator('text=Drawing Mode')).toBeVisible();
      
      console.log('✅ Rapid switching test passed');
      
    } finally {
      await context.close();
    }
  });
});