import { describe, it, expect } from 'vitest';
import { generateNSID } from '../../src/utils/nsid';

describe('generateNSID', () => {
  it('reverses domain and appends name', () => {
    expect(generateNSID('example.com', 'posts')).toBe('com.example.posts');
  });

  it('handles subdomain', () => {
    expect(generateNSID('app.example.com', 'getProfile')).toBe('com.example.app.getprofile');
  });

  it('strips non-alphanumeric from name', () => {
    expect(generateNSID('example.com', 'my-records')).toBe('com.example.myrecords');
  });

  it('lowercases the name', () => {
    expect(generateNSID('example.com', 'MyPosts')).toBe('com.example.myposts');
  });
});
