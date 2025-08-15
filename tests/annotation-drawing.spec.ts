import { test, expect, Page } from '@playwright/test';

// Helper function to login
async function login(page: Page, username: string = 'admin', password: string = 'admin') {
  await page.goto('/login');
  await page.fill('[data-testid="username-input"]', username);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard');
}

// Helper function to create a test project
async function createTestProject(page: Page, projectName: string = 'Test Project') {
  await page.click('[data-testid="create-project-button"]');
  await page.fill('[data-testid="project-name-input"]', projectName);
  await page.click('[data-testid="save-project-button"]');
  await page.waitForSelector(`text=${projectName}`);
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
    name: 'test-image.png',
    mimeType: 'image/png',
    buffer: Buffer.from(testImageData, 'base64'),
  });
  
  // Wait for upload to complete
  await page.waitForSelector('[data-testid="image-thumbnail"]');
}

test.describe('Annotation Drawing', () => {
  test.beforeEach(async ({ page }) => {
    // Start with a clean state
    await page.goto('/');
  });

  test('should allow user to login and access annotation page', async ({ page }) => {
    await login(page);
    
    // Verify we're on the dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('should enable drawing mode and create annotation boxes', async ({ page }) => {
    await login(page);
    
    // Create test project
    const projectName = 'Annotation Test Project';
    await createTestProject(page, projectName);
    
    // Upload test image
    await uploadTestImage(page, projectName);
    
    // Navigate to annotation page
    await page.click('[data-testid="image-thumbnail"]');
    await page.waitForURL(/\/project\/.*\/annotate\/.*/);
    
    // Verify annotation page loaded
    await expect(page.locator('h2')).toContainText('test-image.png');
    
    // Initially should be in selection mode
    await expect(page.locator('text=Selection Mode')).toBeVisible();
    
    // Press 'W' to enable drawing mode
    await page.keyboard.press('w');
    
    // Verify drawing mode is enabled
    await expect(page.locator('text=Drawing Mode')).toBeVisible();
    await expect(page.locator('text=DRAW')).toBeVisible();
    
    // Get the canvas element
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    
    // Draw a bounding box by dragging
    const canvasBounds = await canvas.boundingBox();
    if (!canvasBounds) throw new Error('Canvas not found');
    
    const startX = canvasBounds.x + 50;
    const startY = canvasBounds.y + 50;
    const endX = canvasBounds.x + 150;
    const endY = canvasBounds.y + 150;
    
    // Simulate drawing a box
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY);
    await page.mouse.up();
    
    // Wait a moment for the annotation to be processed
    await page.waitForTimeout(1000);
    
    // Verify annotation was created
    await expect(page.locator('text=Current Annotations (1)')).toBeVisible();
    
    // Verify saving indicator appeared
    await expect(page.locator('text=Saving...')).toBeVisible({ timeout: 5000 });
    
    // Wait for save to complete
    await expect(page.locator('text=Saving...')).not.toBeVisible({ timeout: 10000 });
    
    console.log('✅ Drawing box test completed successfully');
  });

  test('should persist annotations across page reloads', async ({ page }) => {
    await login(page);
    
    // Create test project
    const projectName = 'Persistence Test Project';
    await createTestProject(page, projectName);
    
    // Upload test image
    await uploadTestImage(page, projectName);
    
    // Navigate to annotation page
    await page.click('[data-testid="image-thumbnail"]');
    await page.waitForURL(/\/project\/.*\/annotate\/.*/);
    
    // Enable drawing mode
    await page.keyboard.press('w');
    await expect(page.locator('text=Drawing Mode')).toBeVisible();
    
    // Draw annotation
    const canvas = page.locator('canvas').first();
    const canvasBounds = await canvas.boundingBox();
    if (!canvasBounds) throw new Error('Canvas not found');
    
    await page.mouse.move(canvasBounds.x + 50, canvasBounds.y + 50);
    await page.mouse.down();
    await page.mouse.move(canvasBounds.x + 150, canvasBounds.y + 150);
    await page.mouse.up();
    
    // Wait for save
    await page.waitForTimeout(2000);
    await expect(page.locator('text=Saving...')).not.toBeVisible({ timeout: 10000 });
    
    // Reload the page
    await page.reload();
    await page.waitForURL(/\/project\/.*\/annotate\/.*/);
    
    // Verify annotation persisted
    await expect(page.locator('text=Current Annotations (1)')).toBeVisible({ timeout: 10000 });
    
    console.log('✅ Annotation persistence test completed successfully');
  });

  test('should allow switching between classes and creating different colored boxes', async ({ page }) => {
    await login(page);
    
    // Create test project
    const projectName = 'Multi-Class Test Project';
    await createTestProject(page, projectName);
    
    // Upload test image
    await uploadTestImage(page, projectName);
    
    // Navigate to annotation page
    await page.click('[data-testid="image-thumbnail"]');
    await page.waitForURL(/\/project\/.*\/annotate\/.*/);
    
    // Enable drawing mode
    await page.keyboard.press('w');
    
    // Select first class (press '1')
    await page.keyboard.press('1');
    await expect(page.locator('text=1. person')).toHaveClass(/bg-blue-100/);
    
    // Draw first annotation
    const canvas = page.locator('canvas').first();
    const canvasBounds = await canvas.boundingBox();
    if (!canvasBounds) throw new Error('Canvas not found');
    
    await page.mouse.move(canvasBounds.x + 50, canvasBounds.y + 50);
    await page.mouse.down();
    await page.mouse.move(canvasBounds.x + 100, canvasBounds.y + 100);
    await page.mouse.up();
    
    await page.waitForTimeout(500);
    
    // Select second class (press '2')
    await page.keyboard.press('2');
    await expect(page.locator('text=2. car')).toHaveClass(/bg-blue-100/);
    
    // Draw second annotation
    await page.mouse.move(canvasBounds.x + 120, canvasBounds.y + 120);
    await page.mouse.down();
    await page.mouse.move(canvasBounds.x + 170, canvasBounds.y + 170);
    await page.mouse.up();
    
    // Wait for saves
    await page.waitForTimeout(2000);
    await expect(page.locator('text=Saving...')).not.toBeVisible({ timeout: 10000 });
    
    // Verify both annotations exist
    await expect(page.locator('text=Current Annotations (2)')).toBeVisible();
    
    console.log('✅ Multi-class annotation test completed successfully');
  });

  test('should allow deleting annotations', async ({ page }) => {
    await login(page);
    
    // Create test project
    const projectName = 'Delete Test Project';
    await createTestProject(page, projectName);
    
    // Upload test image
    await uploadTestImage(page, projectName);
    
    // Navigate to annotation page
    await page.click('[data-testid="image-thumbnail"]');
    await page.waitForURL(/\/project\/.*\/annotate\/.*/);
    
    // Enable drawing mode and create annotation
    await page.keyboard.press('w');
    
    const canvas = page.locator('canvas').first();
    const canvasBounds = await canvas.boundingBox();
    if (!canvasBounds) throw new Error('Canvas not found');
    
    await page.mouse.move(canvasBounds.x + 50, canvasBounds.y + 50);
    await page.mouse.down();
    await page.mouse.move(canvasBounds.x + 150, canvasBounds.y + 150);
    await page.mouse.up();
    
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Current Annotations (1)')).toBeVisible();
    
    // Exit drawing mode
    await page.keyboard.press('w');
    await expect(page.locator('text=Selection Mode')).toBeVisible();
    
    // Click on the annotation to select it
    await page.mouse.click(canvasBounds.x + 100, canvasBounds.y + 100);
    
    // Press Delete to remove it
    await page.keyboard.press('Delete');
    
    // Wait for deletion to process
    await page.waitForTimeout(1000);
    
    // Verify annotation was deleted
    await expect(page.locator('text=Current Annotations (0)')).toBeVisible();
    
    console.log('✅ Annotation deletion test completed successfully');
  });
});